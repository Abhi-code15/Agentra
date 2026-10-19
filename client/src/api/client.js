const API_BASE = '/api/v1';

function getCsrfTokenFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)agentra_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiRequest(endpoint, { method = 'GET', body, headers = {} } = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  // Add CSRF token header for mutating requests
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) {
      requestHeaders['X-CSRF-Token'] = csrfToken;
    }
  }

  const options = {
    method,
    headers: requestHeaders,
    credentials: 'include'
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = data?.error?.code || 'API_ERROR';
    err.details = data?.error?.details;
    throw err;
  }

  return data;
}

export const api = {
  get: (endpoint, headers) => apiRequest(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers) => apiRequest(endpoint, { method: 'POST', body, headers }),
  patch: (endpoint, body, headers) => apiRequest(endpoint, { method: 'PATCH', body, headers }),
  put: (endpoint, body, headers) => apiRequest(endpoint, { method: 'PUT', body, headers }),
  delete: (endpoint, headers) => apiRequest(endpoint, { method: 'DELETE', headers })
};
