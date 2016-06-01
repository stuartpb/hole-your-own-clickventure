/* global chrome clickventureNameToUrl */

// When the extension is installed or upgraded ...
chrome.runtime.onInstalled.addListener(function() {
  // Replace all rules ...
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    // With a new rule ...
	    chrome.declarativeContent.onPageChanged.addRules([
	      {
	        // That fires when a page's URL matches a ClickVenture ...
	        conditions: [
	          new chrome.declarativeContent.PageStateMatcher({
	            pageUrl: {
	              hostEquals: 'www.clickhole.com',
	              pathPrefix: '/clickventure/'
	            }
	          })
	        ],
	        // And shows the extension's page action.
	        actions: [ new chrome.declarativeContent.ShowPageAction() ]
	      }
	    ]);
	  });
	});

function recordSeen(clickventureUrl, nodeId) {
  var clickventureName =
  chrome.storage.get({clickventures:{}}, function(storeData) {

  var seenNodes = (storeData.clickventures[clickventureName] =
    storeData.clickventures[clickventureName] || {seenNodes: []}).seenNodes;

    if (seenNodes.indexOf(nodeId) == -1) {
      seenNodes[seenNodes.length] = nodeId;
      seenNodes.sort();
      chrome.storage.set(storeData);
    }
  });
}

chrome.runtime.onMessage.addListener(function onMessageCallback(msg, sender) {
  if (msg.type == 'action') {
    recordSeen(sender.url, msg.target);
  }
});
