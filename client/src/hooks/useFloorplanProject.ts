import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type FloorplanProject, type InsertProject } from "@shared/schema";

export function useFloorplanProjects() {
  return useQuery<FloorplanProject[]>({
    queryKey: ['/api/projects'],
  });
}

export function useFloorplanProject(id: string | null) {
  return useQuery<FloorplanProject>({
    queryKey: ['/api/projects', id],
    enabled: !!id,
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: async (data: InsertProject) => {
      return apiRequest<FloorplanProject>('POST', '/api/projects', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });
}

export function useUpdateProject() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FloorplanProject> }) => {
      return apiRequest<FloorplanProject>('PATCH', `/api/projects/${id}`, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', variables.id] });
    },
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });
}

export function usePrepareExport() {
  return useMutation({
    mutationFn: async (data: { shapes: any[]; options: any }) => {
      return apiRequest('POST', '/api/export/prepare', data);
    },
  });
}
