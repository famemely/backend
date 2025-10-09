# 📡 MQTT Module - Real-time Messaging System

## Overview
The MQTT module provides real-time publish/subscribe messaging capabilities for the Famemely backend using MQTT protocol and WebSocket integration.

## Features

### 🎯 Core Features
- **MQTT Client Integration** - Connect to any MQTT broker
- **Publish/Subscribe** - Full pub/sub messaging support
- **WebSocket Gateway** - Real-time bidirectional communication
- **Quality of Service** - Support for QoS 0, 1, and 2
- **Topic Management** - Subscribe/unsubscribe to multiple topics
- **Auto-Reconnection** - Automatic reconnection on connection loss
- **Message Broadcasting** - Broadcast messages to all subscribers

### 🔌 Connection Features
- Multiple protocol support (mqtt, mqtts, ws, wss)
- Configurable connection parameters
- Connection status monitoring
- Reconnection handling
- Error recovery

### 📊 Management Features
- Subscription tracking
- Statistics and monitoring
- Message handlers
- Client management
- Health checks

## Configuration

### Environment Variables
Add these to your `.env` file:

```bash
MQTT_HOST=broker.hivemq.com
MQTT_PORT=1883
MQTT_PROTOCOL=mqtt
MQTT_USERNAME=          # Optional
MQTT_PASSWORD=          # Optional
```

### Supported Protocols
- `mqtt` - MQTT over TCP
- `mqtts` - MQTT over TLS
- `ws` - MQTT over WebSocket
- `wss` - MQTT over Secure WebSocket

## API Endpoints

### REST API

#### Health Check
```
GET /mqtt/health
```

#### Connection Status
```
GET /mqtt/status
```
Returns:
```json
{
  "isConnected": true,
  "clientId": "famemely_1234567890",
  "connectedAt": "2025-10-10T10:00:00.000Z",
  "reconnectAttempts": 0
}
```

#### Publish Message
```
POST /mqtt/publish
Content-Type: application/json
Authorization: Bearer <token>

{
  "topic": "sensors/temperature",
  "payload": {
    "temperature": 25.5,
    "unit": "C"
  },
  "qos": 0,
  "retain": false
}
```

#### Subscribe to Topic
```
POST /mqtt/subscribe
Content-Type: application/json
Authorization: Bearer <token>

{
  "topic": "sensors/#",
  "qos": 0
}
```

#### Unsubscribe from Topic
```
DELETE /mqtt/unsubscribe/:topic
Authorization: Bearer <token>
```

#### Get User Subscriptions
```
GET /mqtt/subscriptions
Authorization: Bearer <token>
```

#### Get Statistics
```
GET /mqtt/stats
Authorization: Bearer <token>
```
Returns:
```json
{
  "isConnected": true,
  "clientId": "famemely_1234567890",
  "totalSubscriptions": 5,
  "activeSubscriptions": 5,
  "reconnectAttempts": 0,
  "connectedAt": "2025-10-10T10:00:00.000Z"
}
```

#### Broadcast Message
```
POST /mqtt/broadcast
Content-Type: application/json
Authorization: Bearer <token>

{
  "topic": "broadcast/all",
  "message": {
    "title": "System Alert",
    "body": "Maintenance scheduled"
  },
  "includeTimestamp": true
}
```

## WebSocket API

### Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/mqtt', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Connection Status
```javascript
socket.on('mqtt:status', (status) => {
  console.log('MQTT Status:', status);
});

// Request status
socket.emit('mqtt:status');
```

#### Publish Message
```javascript
socket.emit('mqtt:publish', {
  topic: 'sensors/temperature',
  payload: { temperature: 25.5, unit: 'C' },
  qos: 0
});

socket.on('mqtt:publish:success', (data) => {
  console.log('Published:', data);
});

socket.on('mqtt:publish:error', (error) => {
  console.error('Publish error:', error);
});
```

#### Subscribe to Topic
```javascript
socket.emit('mqtt:subscribe', {
  topic: 'sensors/#',
  qos: 0
});

socket.on('mqtt:subscribe:success', (data) => {
  console.log('Subscribed:', data);
});

// Receive messages
socket.on('mqtt:message', (message) => {
  console.log('Received:', message);
  // {
  //   topic: 'sensors/temperature',
  //   payload: { temperature: 25.5, unit: 'C' },
  //   qos: 0,
  //   timestamp: '2025-10-10T10:00:00.000Z'
  // }
});
```

#### Unsubscribe from Topic
```javascript
socket.emit('mqtt:unsubscribe', {
  topic: 'sensors/#'
});

socket.on('mqtt:unsubscribe:success', (data) => {
  console.log('Unsubscribed:', data);
});
```

#### Get Subscriptions
```javascript
socket.emit('mqtt:subscriptions');

socket.on('mqtt:subscriptions', (subscriptions) => {
  console.log('My subscriptions:', subscriptions);
});
```

## Usage Examples

### Frontend Integration (React)

```typescript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function MqttClient() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3001/mqtt', {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.on('connect', () => {
      setStatus('connected');
      
      // Subscribe to topic
      newSocket.emit('mqtt:subscribe', {
        topic: 'chat/room1',
        qos: 1
      });
    });

    newSocket.on('mqtt:message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('disconnect', () => {
      setStatus('disconnected');
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  const sendMessage = (text) => {
    socket.emit('mqtt:publish', {
      topic: 'chat/room1',
      payload: { text, user: 'current-user', timestamp: new Date() },
      qos: 1
    });
  };

  return (
    <div>
      <div>Status: {status}</div>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>{msg.payload.text}</div>
        ))}
      </div>
      <button onClick={() => sendMessage('Hello!')}>
        Send Message
      </button>
    </div>
  );
}
```

### Backend Service Usage

```typescript
import { Injectable } from '@nestjs/common';
import { MqttService } from './mqtt/services/mqtt.service';

@Injectable()
export class NotificationService {
  constructor(private mqttService: MqttService) {
    // Register message handler
    this.mqttService.registerMessageHandler('notifications/#', (message) => {
      this.handleNotification(message);
    });
  }

  async sendNotification(userId: string, notification: any) {
    await this.mqttService.publish({
      topic: `notifications/${userId}`,
      payload: notification,
      qos: 1,
      retain: false
    });
  }

  private handleNotification(message: MqttMessage) {
    console.log('Received notification:', message);
    // Process notification...
  }
}
```

## Topic Naming Conventions

### Recommended Structure
```
app/
  ├── users/{userId}/
  │   ├── notifications
  │   ├── messages
  │   └── status
  ├── chat/
  │   ├── rooms/{roomId}
  │   └── direct/{userId1}/{userId2}
  ├── sensors/
  │   ├── temperature
  │   └── humidity
  └── broadcast/
      ├── announcements
      └── alerts
```

### Wildcards
- `#` - Multi-level wildcard (e.g., `sensors/#` matches all sensor topics)
- `+` - Single-level wildcard (e.g., `users/+/status` matches any user's status)

## Quality of Service (QoS)

- **QoS 0** - At most once delivery (fire and forget)
- **QoS 1** - At least once delivery (acknowledged)
- **QoS 2** - Exactly once delivery (assured)

## Security

### Authentication
All REST and WebSocket endpoints require JWT authentication via `SupabaseAuthGuard`.

### Authorization
Implement topic-level permissions:
- Check user permissions before allowing publish
- Validate subscription requests
- Use topic prefixes for user-specific data

## Performance Tips

1. **Use appropriate QoS levels**
   - QoS 0 for non-critical data
   - QoS 1 for important messages
   - QoS 2 only when absolutely necessary

2. **Optimize topic structure**
   - Use hierarchical topics
   - Avoid deep nesting
   - Use wildcards wisely

3. **Message size**
   - Keep payloads small
   - Use compression for large data
   - Consider pagination for lists

4. **Connection management**
   - Reuse connections
   - Handle reconnections gracefully
   - Clean up subscriptions

## Monitoring

### Health Checks
```bash
# Check MQTT service health
curl http://localhost:3001/mqtt/health

# Get connection status
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:3001/mqtt/status

# Get statistics
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:3001/mqtt/stats
```

### Logging
The service logs:
- Connection events
- Publish/subscribe operations
- Errors and reconnection attempts
- Message handling

## Troubleshooting

### Connection Issues
```bash
# Check broker accessibility
telnet broker.hivemq.com 1883

# Verify environment variables
npm run start:dev | grep MQTT
```

### Common Errors
- **"MQTT client is not connected"** - Wait for connection or check broker status
- **"Failed to subscribe"** - Check topic format and permissions
- **"Reconnection attempts"** - Check network and broker availability

## Dependencies

```json
{
  "mqtt": "^5.0.0",
  "@nestjs/websockets": "^11.0.1",
  "@nestjs/platform-socket.io": "^11.0.1",
  "socket.io": "^4.7.0"
}
```

## Installation

```bash
# Install MQTT dependencies
npm install mqtt @nestjs/websockets @nestjs/platform-socket.io socket.io
```

## Testing

### Unit Tests
```bash
npm run test -- mqtt
```

### Manual Testing
```bash
# Install MQTT client
npm install -g mqtt

# Subscribe to topic
mqtt sub -t 'test/#' -h broker.hivemq.com -v

# Publish message
mqtt pub -t 'test/hello' -m '{"message":"Hello World"}' -h broker.hivemq.com
```

## Future Enhancements

- 📱 Push notifications integration
- 🔒 Enhanced topic permissions
- 📊 Message persistence
- 🔄 Message queue integration
- 📈 Advanced analytics
- 🌍 Multi-broker support

## Version
**v1.0.0** - Initial Release

---

Built with ❤️ by the Famemely Team
