import { Message, Participant, Thread } from "@/server-utils/models/Inbox";

export const participants: Participant[] = [
  { id: "piter", name: "Piter", avatar: "/images/user/user-18.png" },
  { id: "devid", name: "Devid", avatar: "/images/user/user-03.png" },
  { id: "jolly", name: "Jolly", avatar: "/images/user/user-28.png" },
  { id: "roman", name: "Roman", avatar: "/images/user/user-27.png" },
  { id: "finance", name: "Finance Bot", avatar: "/images/user/user-26.png" },
];

export const threads: Thread[] = [
  { id: "t1", title: "Piter",   participants: [participants[0]], lastMessageAt: new Date().toISOString(), unread: 2 },
  { id: "t2", title: "Devid",   participants: [participants[1]], lastMessageAt: new Date().toISOString(), unread: 0 },
  { id: "t3", title: "Finance", participants: [participants[4]], lastMessageAt: new Date().toISOString(), unread: 1 },
  { id: "t4", title: "Jolly",   participants: [participants[2]], lastMessageAt: new Date().toISOString(), unread: 0 },
  { id: "t5", title: "Roman",   participants: [participants[3]], lastMessageAt: new Date().toISOString(), unread: 0 },
];

export const messages: Message[] = [
  { id: "m1", threadId: "t1", authorId: "piter", text: "Hey! Mi sono unito al team 🚀", createdAt: new Date(Date.now()-1000*60*60).toISOString() },
  { id: "m2", threadId: "t1", authorId: "me",    text: "Grande, benvenuto!", createdAt: new Date(Date.now()-1000*60*50).toISOString() },

  { id: "m3", threadId: "t2", authorId: "devid", text: "Nuovo messaggio per te 😄", createdAt: new Date(Date.now()-1000*60*30).toISOString() },

  { id: "m4", threadId: "t3", authorId: "finance", text: "Payment received ✅ Controlla i guadagni.", createdAt: new Date(Date.now()-1000*60*40).toISOString() },

  { id: "m5", threadId: "t4", authorId: "jolly", text: "Task completati, vuoi assegnare altro?", createdAt: new Date(Date.now()-1000*60*70).toISOString() },

  { id: "m6", threadId: "t5", authorId: "roman", text: "Mi sono unito anche io, ciao!", createdAt: new Date(Date.now()-1000*60*90).toISOString() },
];

// util per simulare fetch
export async function getThreads(): Promise<Thread[]> {
  await new Promise(r => setTimeout(r, 200));
  return threads;
}
export async function getMessages(threadId: string): Promise<Message[]> {
  await new Promise(r => setTimeout(r, 200));
  return messages.filter(m => m.threadId === threadId);
}
export function resolveParticipant(id: string) {
  if (id === "me") return { id: "me", name: "Tu" };
  return participants.find(p => p.id === id);
}
