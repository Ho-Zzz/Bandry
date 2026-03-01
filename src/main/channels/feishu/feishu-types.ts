export type FeishuSender = {
  sender_id?: {
    open_id?: string;
    user_id?: string;
    union_id?: string;
  };
  sender_type: string;
  tenant_key?: string;
};

export type FeishuRawEventData = {
  event_id?: string;
  token?: string;
  create_time?: string;
  event_type?: string;
  tenant_key?: string;
  ts?: string;
  uuid?: string;
  type?: string;
  app_id?: string;
  sender: FeishuSender;
  message: {
    message_id: string;
    chat_id: string;
    chat_type: string;
    content: string;
    message_type: string;
    create_time: string;
    root_id?: string;
    parent_id?: string;
  };
};
