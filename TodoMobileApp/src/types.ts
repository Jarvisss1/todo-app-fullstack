export interface Task {
  _id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: 'Low' | 'Medium' | 'High';
  category: string; // New Field
  isCompleted: boolean;
  createdAt: string;
}

export interface User {
  email: string;
  token: string;
}