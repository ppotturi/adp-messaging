const { ServiceBusAdministrationClient } = require('@azure/service-bus')
const { DefaultAzureCredential } = require('@azure/identity')

class AdminClient {
  constructor (config) {
    this.connectionName = config.name || config.address
    this.appInsights = config.appInsights
    this.config = config
    this.connect()
  }

  connect () {
    if (this.config.useCredentialChain) {
      const credentials = this.getCredentials()
      this.sbClient = new ServiceBusAdministrationClient(this.config.host, credentials)
    } else if (this.config.connectionString) {
      this.sbClient = new ServiceBusAdministrationClient(this.config.connectionString)
    } else {
      this.sbClient = new ServiceBusAdministrationClient(`Endpoint=sb://${this.config.host}/;SharedAccessKeyName=${this.config.username};SharedAccessKey=${this.config.password}`)
    }
  }

  getCredentials () {
    if (this.config.managedIdentityClientId) {
      return new DefaultAzureCredential({ managedIdentityClientId: this.config.managedIdentityClientId })
    } else {
      return new DefaultAzureCredential()
    }
  }

  async getClient () {
    return this.sbClient
  }
}

module.exports = AdminClient
