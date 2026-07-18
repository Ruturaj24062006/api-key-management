const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  production: !isLocal,
  apiUrl: isLocal ? 'http://localhost:8080/api/v1' : 'https://nexus-backend-gmd1.onrender.com/api/v1',
  googleClientId: '562305543169-qgghq9tr4v4o0npsqg27sc6ndv7b0688.apps.googleusercontent.com'
};
