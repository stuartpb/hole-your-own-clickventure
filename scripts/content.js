/* global chrome MutationObserver */

function forEachOfClassName(className, cb) {
  var els = document.getElementsByClassName(className);
  for (var i=0; i<els.length; i++) {
    cb(els[i]);
  }
}

function addClassListener(className, eventType, listener) {
  return forEachOfClassName(className, function (el) {
    el.addEventListener(eventType, listener);
  });
}

function observeClass(className, observer, options) {
  return forEachOfClassName(className, function(el) {
    observer.observe(el, options);
  });
}

function reportNewActiveNode(target) {
  chrome.runtime.sendMessage(null, {type: 'action', target: target});
}

// report initial active node, for tracking seen nodes when visiting
var initialActiveNode =
  document.getElementsByClassName('clickventure-node-active')[0];
if (initialActiveNode) {
  chrome.runtime.sendMessage(null, {type: 'initialization',
    target: initialActiveNode.dataset.nodeId});
}

addClassListener('clickventure-node-link', 'mouseenter', function(evt) {
  chrome.runtime.sendMessage(null, {
    type: 'hover', target: evt.target.dataset.targetNode});
});

addClassListener('clickventure-node-link', 'mouseleave', function(evt) {
  chrome.runtime.sendMessage(null, {type: 'unhover'});
});

var activeNodeObserver = new MutationObserver(function(records) {
  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    if (record.attributeName == 'class') {
      if (record.target.classList.contains('clickventure-node-active')) {
        reportNewActiveNode(record.target.dataset.nodeId);
      }
    }
  }
});

observeClass('clickventure-node', activeNodeObserver, {attributes: true});

function assessLayout() {
  var layout = {
    nodes: []
  };
  var nodes = document.getElementsByClassName('clickventure-node');
  var layoutNodes = layout.nodes;
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.classList.contains('clickventure-node-start')) {
      layout.start = node.dataset.nodeId;
    }
    // Include initial active node
    if (node.classList.contains('clickventure-node-active')) {
      layout.active = node.dataset.nodeId;
    }
    var outboundNodes = [];
    var nodeLinks = node.getElementsByClassName('clickventure-node-link');
    for (var j = 0; j < nodeLinks.length; j++) {
      var targetId = nodeLinks[j].dataset.targetNode;
      if (outboundNodes.indexOf(targetId) == -1) {
        outboundNodes[outboundNodes.length] = targetId;
      }
    }
    outboundNodes.sort();
    layoutNodes[i] = {
      id: node.dataset.nodeId,
      name: node.dataset.nodeName,
      links: outboundNodes,
      finish: node.classList.contains('clickventure-node-finish')
    };
  }
  return layout;
}

chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
  if (msg.type == 'layout') {
    respond(assessLayout());
  }
});
