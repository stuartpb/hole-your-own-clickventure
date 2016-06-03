/* global chrome clickventureUrlToName cre d3 cola */

var layout;

// graph info for cola layout
var graphLinks = [];
// list of nodes for cola layout
var graphLayoutNodes = [];
// list of nodes for d3 binding
// (the list of layout nodes, without the intermediates)
var graphPlottedNodes;
// array of references for plotting link paths (d3 binding)
var bilinks = [];

// list of node marker elements for d3
var nodeMarkerList = [];
// list of link path elements for d3
var nodeLinkList = [];
// list of node element groups for appending
var nodeGroupList = [];

var seenNodes = new Set();

// this is a "map" in the sense of a navigational aid
var clickventureMap = document.getElementById('map');
// this is a "map" in the sense of a data structure
var nodeElementsMap = new Map();

var activeNode;
function setActiveNode(id) {
  // deactivate old active node
  nodeElementsMap.get(activeNode).group.classList.remove('active');
  // activate new active node
  nodeElementsMap.get(id).group.classList.add('active');
  markNodeAsSeen(id);
  activeNode = id;
}

function setHoveredLink(id) {
  return nodeElementsMap.get(activeNode)
    .linkMap.get(id).classList.add('hovered');
}

function unsetHoveredLink() {
  var hovered = nodeElementsMap.get(activeNode)
    .linkGroup.getElementsByClassName('hovered');
  for (var i = 0; i < hovered.length; i++) {
    hovered[i].classList.remove('hovered');
  }
}

function getCurrentUrl(cb) {
  return chrome.tabs.query({active: true, currentWindow: true},
    function(tabs) {
      return cb(tabs[0].url);
    });
}

function getSeenNodes(cb) {
  var clickventureName, storedClickventures;
  function returnSeenNodes() {
    var clickventure = storedClickventures[clickventureName];
    return cb(clickventure ? clickventure.seenNodes : []);
  }
  getCurrentUrl(function(url) {
    clickventureName = clickventureUrlToName(url);
    if (storedClickventures) return returnSeenNodes();
  });
  chrome.storage.sync.get({clickventures:{}}, function(storeData) {
    storedClickventures = storeData.clickventures;
    if (clickventureName) return returnSeenNodes();
  });
}

function goToNode(id) {
  return getCurrentUrl(function(url) {
    var targetUrl = url.replace(/#.*$/,'') + '#' + id;
    chrome.tabs.update(null, {url: targetUrl}, function() {
      // because clickventure fails to recognize hash changes,
      // we have to outright reload after navigating
      chrome.tabs.reload(null, setActiveNode.bind(null,id));
    });
  });
}

var nodeRadius = 10;

var teNodeGroup = cre.svg('g.node-group');
var teNodeLinkGroup = cre.svg('g.node-links');
var teNodeMarker = cre.svg('g.node');
var teNodeTitleElement = cre.svg('title');
var teNodeCircle = cre.svg('circle', {
  attributes: [{name: 'r', value: nodeRadius}]
});
var teNodeLabel = cre.svg('text');
var teNodeLink = cre.svg('path.link');

function createNodeElements(i) {
  var node = layout.nodes[i];
  var nodeId = node.id;
  var nodeMarker = cre(teNodeMarker, [
    cre(teNodeTitleElement, [node.name]),
    cre(teNodeCircle),
    cre(teNodeLabel, [nodeId])
  ]);
  var nodeLinkGroup = cre(teNodeLinkGroup);
  var nodeGroup = cre(teNodeGroup, [nodeMarker, nodeLinkGroup]);

  nodeGroup.classList.add(seenNodes.has(node.id) ? 'seen' : 'unseen');

  nodeMarker.addEventListener('click', function (evt) {
    goToNode(nodeId);
  });

  nodeMarkerList[nodeMarkerList.length] = nodeMarker;
  nodeGroupList[nodeGroupList.length] = nodeGroup;

  return {
    node: node,
    graphNode: graphLayoutNodes[graphLayoutNodes.length] = {},
    group: nodeGroup,
    marker: nodeMarker,
    linkGroup: nodeLinkGroup,
    linkMap: new Map(),
    index: i
  };
}

function createNodeLinks(iSource) {
  // create node link and append it to
  var node = layout.nodes[iSource];
  var links = node.links;
  for (var i = 0; i < links.length; i++) {
    var iTarget = nodeElementsMap.get(links[i]).index;
    var bilink = bilinks[bilinks.length] = [
      graphLayoutNodes[iSource],
      graphLayoutNodes[graphLayoutNodes.length] = {},
      graphLayoutNodes[iTarget]];
    graphLinks.push(
      {source: bilink[0], target: bilink[1]},
      {source: bilink[1], target: bilink[2]});
    var linkPath = cre(teNodeLink);
    var nodeElements = nodeElementsMap.get(node.id);
    nodeElements.linkGroup.appendChild(linkPath);
    nodeElements.linkMap.set(links[i], linkPath);
    nodeLinkList[nodeLinkList.length] = linkPath;
  }
}

function populateLayout(layoutObj) {
  // save incoming layout
  layout = layoutObj;

  // initialize node elements
  for (var i = 0; i < layout.nodes.length; i++) {
    nodeElementsMap.set(layout.nodes[i].id, createNodeElements(i));
  }

  // slice nodes to plot for d3 binding
  graphPlottedNodes = graphLayoutNodes.slice();

  // set up links and append to tree
  for (var i = 0; i < layout.nodes.length; i++) {
    createNodeLinks(i);
    clickventureMap.appendChild(nodeGroupList[i]);
  }

  // Initialize activeNode
  activeNode = layout.start;
  setActiveNode(layout.active);

  // bind data for d3
  var mapNodes = d3.selectAll(nodeMarkerList).data(graphPlottedNodes);
  var mapLinks = d3.selectAll(nodeLinkList).data(bilinks);

  var d3cola = cola.d3adaptor();
  d3cola.nodes(graphLayoutNodes).links(graphLinks)
    .flowLayout('x', 20).start(10,20,20);

  d3cola.on("tick", function () {
    mapLinks.attr('d', function (d) {
      return "M" + d[0].x + "," + d[0].y
          + "S" + d[1].x + "," + d[1].y
          + " " + d[2].x + "," + d[2].y;
    });

    mapNodes.attr("transform",function (d) {
      return "translate(" + d.x + ',' + d.y + ")";
    });
  });
}

function markNodeAsSeen(id) {
  seenNodes.add(id);
  if (layout) {
    var nodeElements = nodeElementsMap.get(id);
    var nodeGroup = nodeElements.group;
    nodeGroup.classList.remove('unseen');
    nodeGroup.classList.remove('glimpsed');
    nodeGroup.classList.add('seen');

    // mark all targets as at least glimpsed
    var links = nodeElements.node.links;
    for (var i = 0; i < links.length; i++) {
      var targetGroup = nodeElementsMap.get(links[i]).group;
      if (!targetGroup.classList.contains('seen')) {
        nodeGroup.classList.remove('unseen');
        nodeGroup.classList.add('glimpsed');
      }
    }
  }
}

function spoilNodes() {
  for (var i = 0; i < layout.nodes.length; i++) {
    markNodeAsSeen(layout.nodes[i].id);
  }
}

function resetNodes() {
  function setGroupUnseen(nodeElements) {
    var nodeGroup = nodeElements.nodeGroup;
    nodeGroup.classList.remove('seen');
    nodeGroup.classList.remove('glimpsed');
    nodeGroup.classList.add('unseen');
  }
  seenNodes.clear();
  nodeElementsMap.forEach(setGroupUnseen);

  // since we can't know how we got to the current node,
  // and not showing parents would leave siblings etc. inaccessible on the map,
  // restart the clickventure
  goToNode(layout.start);

  // TODO: persist reset
}

document.getElementById('spoil').addEventListener('click', spoilNodes);
document.getElementById('reset').addEventListener('click', resetNodes);

chrome.runtime.onMessage.addListener(function onMessageCallback(msg, sender) {
  if (msg.type == 'hover') {
    setHoveredLink(msg.target);
  } else if (msg.type == 'unhover') {
    unsetHoveredLink();
  } else if (msg.type == 'action') {
    setActiveNode(msg.target);
  }
});

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {type: "layout"}, populateLayout);
});
getSeenNodes(function(seenNodeList) {
  for (var i = 0; i < seenNodeList.length; i++) {
    markNodeAsSeen(seenNodeList[i]);
  }
});
