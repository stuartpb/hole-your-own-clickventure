/* global chrome clickventureUrlToName */

var layout;

var seenNodes = new Set();
var nodeLines = new Map();

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

var hackyList = document.createElement('ul');
var clickventureMap = document.getElementById('map');
clickventureMap.parentElement.appendChild(hackyList);
clickventureMap.remove();

var activeNode;
function setActiveNode(id) {
  // deactivate old active node
  nodeLines.get(activeNode).classList.remove('active');
  // activate new active node
  nodeLines.get(id).classList.add('active');
  markNodeAsSeen(id);
  activeNode = id;
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

function createNodeLine(node) {
  var nodeId = node.id;
  var nodeLinks = node.links;
  var nodeLine = document.createElement('li');
  nodeLines.set(nodeId, nodeLine);
  nodeLine.textContent = nodeId+': '+nodeLinks.join(', ');
  nodeLine.title = node.name;
  nodeLine.hidden = !seenNodes.has(nodeId);
  nodeLine.addEventListener('click', function (evt) {
    goToNode(nodeId);
  });
  hackyList.appendChild(nodeLine);
}

function populateLayout(layoutObj) {
  layout = layoutObj;
  for (var i = 0; i < layout.nodes.length; i++) {
    createNodeLine(layout.nodes[i]);
  }
  // Initialize activeNode
  activeNode = layout.start;
  setActiveNode(layout.active);
}

function markNodeAsSeen(id) {
  seenNodes.add(id);
  if (layout) {
    nodeLines.get(id).hidden = false;
  }
}

function spoilNodes() {
  for (var i = 0; i < layout.nodes.length; i++) {
    markNodeAsSeen(layout.nodes[i].id);
  }
}

function resetNodes() {
  seenNodes.clear();
  for (var i = 0; i < layout.nodes.length; i++) {
    nodeLines.get(layout.nodes[i].id).hidden = true;
  }
  goToNode(layout.start);
  // TODO: persist reset
}

document.getElementById('spoil').addEventListener('click', spoilNodes);
document.getElementById('reset').addEventListener('click', resetNodes);

function setHoveredLink(id) {
  var activeNodeLine = nodeLines.get(activeNode);
  activeNodeLine.textContent = activeNodeLine.textContent.replace(
    new RegExp(id+'(?:, |$)'), '>$&');
}

function unsetHoveredLink() {
  var activeNodeLine = nodeLines.get(activeNode);
  activeNodeLine.textContent = activeNodeLine.textContent.replace(/>/,'');
}

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
