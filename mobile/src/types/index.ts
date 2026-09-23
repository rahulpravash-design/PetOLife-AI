export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed?: string;
  birthDate?: string;
  photoUrl?: string;
  createdAt: string;
}

export type HealthRecordType =
  | 'weight'
  | 'vaccination'
  | 'medication'
  | 'vet_visit'
  | 'symptom'
  | 'lab_result'
  | 'note';

export interface HealthRecord {
  id: string;
  petId: string;
  type: HealthRecordType;
  date: string;
  title: string;
  notes?: string;
  value?: number;
  unit?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  petId: string;
  title: string;
  dueDate: string;
  notes?: string;
  isDone: boolean;
  createdAt: string;
}

export interface WhatChanged {
  metric: string;
  fromValue: number;
  toValue: number;
  deltaAbsolute: number;
  deltaPercent: number;
  fromDate: string;
  toDate: string;
}

export interface Pattern {
  id: string;
  description: string;
  sourceRecordIds: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface AttentionItem {
  id: string;
  message: string;
  sourceRecordIds: string[];
  reasoning: string;
}

export interface HealthSummary {
  petId: string;
  rangeStart: string;
  rangeEnd: string;
  whatHappened: string;
  whatChanged: WhatChanged[];
  patterns: Pattern[];
  attention: AttentionItem[];
  sourceRecordIds: string[];
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourceRecordIds?: string[];
  createdAt: string;
}
