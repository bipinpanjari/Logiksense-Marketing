export interface EmailTransportMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  replyTo?: string;
}

export interface EmailTransportResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response?: string;
}

export interface EmailTransport {
  readonly name: string;
  verify(): Promise<void>;
  send(msg: EmailTransportMessage): Promise<EmailTransportResult>;
}
