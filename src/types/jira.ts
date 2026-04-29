export interface JiraCreateIssueRequest {
  fields: {
    project: { key: string };
    summary: string;
    description: string;
    issuetype: { name: string };
    priority: { name: string };
  };
}

export interface JiraCreateIssueResponse {
  id: string;
  key: string;
}

export interface JiraErrorResponse {
  errors: Record<string, string>;
  errorMessages: string[];
}
