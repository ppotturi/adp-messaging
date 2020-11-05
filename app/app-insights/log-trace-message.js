const appInsights = require('applicationinsights')

module.exports = (message) => {
  if (appInsights.defaultClient !== undefined) {
    appInsights.defaultClient.trackTrace({ message })
  }
}
