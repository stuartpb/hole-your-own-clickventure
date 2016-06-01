function clickventureUrlToName(url) {
  return url.replace(
    /^https?:\/\/www\.clickhole\.com\/clickventure\/([^#]*).*$/, '$1');
}
