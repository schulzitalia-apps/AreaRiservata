export type Participant = {
  id: string;
  name: string;
  avatar?: string;
};

export type Message = {
  id: string;
  threadId: string;
  authorId: string;
  text: string;
  createdAt: string; // ISO
};

export type Thread = {
  id: string;
  title: string;        // es. nome persona o gruppo
  participants: Participant[];
  lastMessageAt: string;
  unread?: number;
};
