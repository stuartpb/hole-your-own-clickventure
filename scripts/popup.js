/* global chrome clickventureUrlToName cytoscape */

var layout;

var seenNodes = new Set();

// this is a "map" in the sense of a navigational aid
var mapContainer = document.getElementById('map');
var cy;

var cyStyle = [
  {
    selector: 'node',
    style: {
      'border-width': '4px',
      'label': 'data(id)',
      'color': 'black',
      'font-size': '10px',
      'height': '20px',
      'width': '20px',
      'shape': 'ellipse',
      'text-valign': 'center'
    }
  },
  {
    selector: 'edge',
    style: {
      'line-color': 'black',
      'width': '2px',
      'opacity': '0.4',
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': 'black'
    }
  },
  {
    selector: 'edge.hovered',
    style: {
      'opacity': '1'
    }
  },
  {
    selector: '.unseen, edge.glimpsed',
    style: {
      'visibility': 'hidden'
    }
  },
  {
    selector: 'node.glimpsed',
    style: {
      'background-color': '#ccc',
      'border-color': '#888'
    }
  },
  {
    selector: 'node.seen',
    style: {
      'background-color': '#fc0',
      'border-color': '#a80'
    }
  },
  {
    selector: 'node.ending',
    style: {
      'background-color': '#ccc',
    }
  },
  {
    selector: 'node.active',
    style: {
      'border-width': '6px',
      'border-style': 'double',
      'height': '25px',
      'width': '25px',
    }
  },
  {
    selector: 'edge.active',
    style: {
      'line-color': '#a80',
      'target-arrow-color': '#a80'
    }
  }
];

function incomingLayoutToCytoscapeElements(incoming) {
  var iNodes = incoming.nodes;
  var els = [];
  for (var i = 0; i < iNodes.length; i++) {
    var iNode = iNodes[i];
    var links = iNode.links;
    // everything gets initialized as unseen, since the individual
    // 'mark as seen' step gets run on all seen nodes anyway after this
    // (to mark all corresponding "glimpsed" nodes).
    var classes = [incoming.start == iNode.id ? 'start seen' : 'unseen'];
    if (incoming.active == iNode.id) {
      classes[classes.length] = 'active';
    }
    if (iNode.finish) {
      classes[classes.length] = 'finish';
    }
    classes = classes.join(' ');
    els[els.length] = {
      group: 'nodes',
      data: {
        id: iNode.id,
        name: iNode.name,
      },
      position: {
        x: i, y: 0
      },
      classes: classes
    };
    for (var j = 0; j < links.length; j++) {
      els[els.length] = {
        group: 'edges',
        data: {
          source: iNode.id,
          target: links[j],
        },
        classes: classes
      };
    }
  }
  return els;
}

function nodeAndEdges(node) {
  var coll = cy.collection(node);
  return coll.add(node.outgoers('edge'));
}

function nodeTargets(node) {
  return node.outgoers('node');
}

function nodeAndAllTargets(node) {
  var coll = cy.collection(node);
  return coll.add(node.outgoers());
}

function fitActiveNodeDecisions(node) {
  cy.fit(nodeAndAllTargets(cy.getElementById(activeNode)), 50);
}

var activeNode;
function setActiveNode(id) {
  // deactivate old active node
  nodeAndEdges(cy.getElementById(activeNode)).removeClass('active');
  // TODO: remove from edges
  // activate new active node
  nodeAndEdges(cy.getElementById(id)).addClass('active');
  markNodeAsSeen(id);
  activeNode = id;
  fitActiveNodeDecisions();
}
function setHoveredLink(id) {
  return cy.getElementById(activeNode)
    .edgesTo(cy.getElementById(id))
    .addClass('hovered');
}

function unsetHoveredLink() {
  return cy.getElementById(activeNode)
    .connectedEdges('.hovered')
    .removeClass('hovered');
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

function upgradeToGlimpsed(node) {
  if (!node.hasClass('seen')) {
    node.removeClass('unseen').addClass('glimpsed');
  }
}

function markNodeAsSeen(id) {
  seenNodes.add(id);
  if (layout) {
    var node = cy.getElementById(id);
    nodeAndEdges(node)
      .removeClass('unseen glimpsed').addClass('seen');

    // mark all targets as at least glimpsed
    nodeTargets(node).forEach(upgradeToGlimpsed);
  }
}

function populateLayout(layoutObj) {
  // save incoming layout
  layout = layoutObj;

  // initialize decision graph
  cy = cytoscape({
    container: mapContainer,
    elements: incomingLayoutToCytoscapeElements(layout),
    style: cyStyle,
    layout: {
      name: 'cose',
      ready: fitActiveNodeDecisions,
      // disable autofit since we do our own
      fit: false
    }
  });

  // set seen / glimpsed states
  seenNodes.forEach(markNodeAsSeen);

  // hook up UI
  cy.nodes().on('click', function (evt) {
    // TODO: ignore if node is invisible?
    goToNode(evt.cyTarget.id());
  });

  // Initialize activeNode
  activeNode = layout.start;
  setActiveNode(layout.active);
}

function spoilNodes() {
  for (var i = 0; i < layout.nodes.length; i++) {
    markNodeAsSeen(layout.nodes[i].id);
  }
}

function resetNodes() {
  seenNodes.clear();
  var eles = cy.elements();
  for (var i = 0; i < eles.length; i++) {
    var el = eles[i];
    // we just blindly set everything unseen
    // since the seen state will get fixed
    // after we go back to start
    el.removeClass('seen glimpsed').addClass('unseen');
  }

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
