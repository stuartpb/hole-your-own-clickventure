function clickventureUrlToName(url) {
  return url.replace(
    /^https?:\/\/www\.clickventure\.com\/clickventure\/([^#]*).*$/, '$1');
}
