# adp-messaging

Messaging npm module for FFC services

## Usage

### Installation

```
npm install --save adp-messaging
```

### Configuration

`name` - name of connection, if not supplied the address name will be used.  This value is also used in App Insights tracing

`host` - Azure Service Bus namespace, for example, `myservicebus.servicebus.windows.net`

`useCredentialChain` - Boolean value for whether to authenticate connection with using Azure's credential chain.  For example, set this to true if you wish to use [Azure Workload Identity](https://github.com/Azure/azure-workload-identity).  If `false`, then `username` and `password` or `connectionString` are required.

`managedIdentityClientId` - Optionally, client Id of the workload identity can be specified if there are multiple applications using different workload identities to authenticate.

`connectionString` - Azure Service Bus connection string.  If provided, `username` and `password` are ignored.

`username` - Azure Service Bus Shared Access Key name for authentication.  Not required if `useCredentialChain` is `true` or `connectionString` is provided.

`password` - Azure Service Bus Shared Access Key value for authentication.  Not required if `useCredentialChain` is `true` or `connectionString` is provided.

`type` - Azure Service Bus entity to connect to, allows `queue`, `sessionQueue`, `topic` or `subscription`.

`address` - Name of the Azure Service Bus queue, topic or subscription to connect to.

`topic` - Required for subscription connections only.  The name of the topic the subscription belongs to.

`appInsights` - Application Insights module if logging is required

`retries` - How many times should a sender try to send a message, defaulting to `5` if not supplied.  With Pod Identity and Azure Identity there is a scenario that the identity will not be allocated in time for it's usage which causes failure sending messages.  `5` is usually sufficient but can be increased if necessary.

`retryWaitInMs` - How long should a sender wait in milliseconds before trying to resend, defaulting to `500` if not supplied.

`exponentialRetry` - Whether to exponentially retry, ie doubling the `retryWaitInMs` on every retry.  Defaulted to `false`.

`autoCompleteMessages` - (Subscriptions only - see below) Whether to auto complete messages once the action method has ran.  Defaults to `false`.

`maxConcurrentCalls` - (Subscriptions only - see below) Maximum number of messages received from message handler without being settled.  Defaults to `1`.

#### Example

```
const config = {
  host: 'myservicebus.servicebus.windows.net',
  useCredentialChain: false,
  username: 'mySharedAccessKeyName',
  password: 'mySharedAccessKey,
  address: 'mySubscription,
  type: 'subscription',
  topic: 'myTopic',
  appInsights: require('applicationinsights'),
  retries: 5
}
```

### Sending a message

Message objects must follow the below structure.

`body` - The body of the message.

`type` - Type of message using reverse DNS notation. For example, `uk.gov.demo.claim.validated`.

`source` - Name of the service sending the message.  For example, `ffc-demo-claim-service`.

`metadata` - Optional object containing metadata to be added to message.

In addition, any property as described in the [Microsoft documentation](https://docs.microsoft.com/en-gb/javascript/api/@azure/service-bus/servicebusmessage?view=azure-node-latest#properties).


#### Example Send Message

```
const message = {
  body: { claimId: 1 },
  type: 'uk.gov.demo.claim.validated',
  subject: 'New Claim',
  source: 'ffc-demo-claim-service',
  metadata: {
    myCustomProperty: 'my-value'
  }
}
```
```
const sender = new MessageSender(config)
await sender.sendMessage(message)

// shutdown when needed
await sender.closeConnection()
```

The `sendMessage` function can also receive all options applicable to Azure Service Bus `sendMessages` as a parameter, see [Azure documentation](https://www.npmjs.com/package/@azure/service-bus).

```
await sender.sendMessage(message, options)
```

#### Example Send Batch Messages

```
const messages = [{
  body: { claimId: 1 },
  type: 'uk.gov.demo.claim.validated',
  subject: 'New Claim 1',
  source: 'ffc-demo-claim-service'
},
{
  body: { claimId: 2 },
  type: 'uk.gov.demo.claim.validated',
  subject: 'New Claim 2',
  source: 'ffc-demo-claim-service'
}]

```
```
const sender = new MessageBatchSender(config)
await sender.sendBatchMessages(messages)

// shutdown when needed
await sender.closeConnection()
```

The `sendBatchMessages` function can also receive all options applicable to Azure Service Bus `sendMessages` as a parameter, see [Azure documentation](https://www.npmjs.com/package/@azure/service-bus).

```
await sender.sendBatchMessages(message, options)
```

### Receiving a message

There are multiple options for receiving a message.

#### Subscribe
Permanently subscribe to all messages.  Automatically will handle any intermittent disconnects.

```
const action = function (message) {
  console.log(message.body)
}

const receiver = new MessageReceiver(config, action)
await receiver.subscribe()

// shutdown when needed
await receiver.closeConnection()
```

#### Accept session
Connect to a specified session.

```

const receiver = new MessageReceiver(config)
await receiver.acceptSession(sessionId)
messages = await receiver.receiveMessages(1)

// shutdown when needed
await receiver.closeConnection()
```

#### Accept next session
Connect to next session.

```

const receiver = new MessageReceiver(config)
await receiver.acceptNextSession()
messages = await receiver.receiveMessages(1)

// shutdown when needed
await receiver.closeConnection()
```

#### Receive
Single call to receive current messages messages.

```
const receiver = new MessageReceiver(config, action)
// receive a maximum of 10 messages
messages = await receiver.receiveMessages(10)

// shutdown when needed
await receiver.closeConnection()
```

The `receiveMessages` function can also receive all options applicable to Azure Service Bus `receiveMessages` as a parameter, see [Azure documentation](https://www.npmjs.com/package/@azure/service-bus).

```
await receiver.receiveMessages(10, options)
```

It is often beneficial when using this to specify the maximum wait time for both the first message and the last message to improve performance of the application.  For example:

```
// This will wait a maximum of one second for the first message, if no message exists then the response will return.  
// If a message is received within one second it will wait a further five seconds or until it receives 10 messages to return
messages = await receiver.receiveMessages(batchSize, { maxWaitTimeInMs: 1000, maxTimeAfterFirstMessageInMs: 5000 })
```

#### Peek
Same as `receiveMessages` but does not mark the message as complete so it can still be received by other services once the peek lock expires.

```
const receiver = new MessageReceiver(config, action)
// receive a maximum of 10 messages
messages = await receiver.peekMessages(10)

// shutdown when needed
await receiver.closeConnection()
```

### Handling a received message
Once a message is received through a peek lock, a response must be sent to Azure Service Bus before the lock expires otherwise Service Bus will resend the message.

If this is not the intended behaviour there are several responses that can be sent.

#### Complete
Message is complete and no further processing needed.

```
await receiver.completeMessage(message)
```

#### Dead Letter
Message cannot be processed by any client so should be added to dead letter queue.

```
await receiver.deadLetterMessage(message)
```

### Abandon
Abandon processing of current message so it can be redelivered, potentially to another client.

```
await receiver.abandonMessage(message)
```

### Defer
Defer message back to queue for later processing.  It will not be redelivered to any client unless the receiver command supplies the sequence number as an option.

[Further reading on deferring messages](https://docs.microsoft.com/en-gb/azure/service-bus-messaging/message-deferral)

```
// Defer
await receiver.deferMessage(message)
```

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT
LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and
applications when using this information.

> Contains public sector information licensed under the Open Government license
> v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her
Majesty's Stationery Office (HMSO) to enable information providers in the
public sector to license the use and re-use of their information under a common
open licence.

It is designed to encourage use and re-use of information freely and flexibly,
with only a few conditions.
