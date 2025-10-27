import { type FloorplanProject, type InsertProject, type FloorplanShape } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getProject(id: string): Promise<FloorplanProject | undefined>;
  getAllProjects(): Promise<FloorplanProject[]>;
  createProject(project: InsertProject): Promise<FloorplanProject>;
  updateProject(id: string, updates: Partial<FloorplanProject>): Promise<FloorplanProject | undefined>;
  deleteProject(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, FloorplanProject>;

  constructor() {
    this.projects = new Map();
  }

  async getProject(id: string): Promise<FloorplanProject | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<FloorplanProject[]> {
    return Array.from(this.projects.values());
  }

  async createProject(insertProject: InsertProject): Promise<FloorplanProject> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const project: FloorplanProject = {
      ...insertProject,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<FloorplanProject>): Promise<FloorplanProject | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject: FloorplanProject = {
      ...project,
      ...updates,
      id: project.id,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }
}

export const storage = new MemStorage();
