export interface MqttMessage {
  topic: string;
  payload: any;
  qos: 0 | 1 | 2;
  retain?: boolean;
  timestamp: Date;
  messageId?: string;
}

export interface MqttSubscription {
  id: string;
  topic: string;
  qos: 0 | 1 | 2;
  userId: string;
  createdAt: Date;
  isActive: boolean;
}

export interface MqttClientConfig {
  host: string;
  port: number;
  protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';
  username?: string;
  password?: string;
  clientId: string;
  clean: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
}

export interface MqttConnectionStatus {
  isConnected: boolean;
  clientId: string;
  connectedAt?: Date;
  lastError?: string;
  reconnectAttempts: number;
}

export interface MqttTopicPermission {
  userId: string;
  topic: string;
  canPublish: boolean;
  canSubscribe: boolean;
  createdAt: Date;
}

export enum MqttQoS {
  AtMostOnce = 0,
  AtLeastOnce = 1,
  ExactlyOnce = 2,
}

export enum MqttEventType {
  Connect = 'connect',
  Disconnect = 'disconnect',
  Message = 'message',
  Error = 'error',
  Reconnect = 'reconnect',
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
}
