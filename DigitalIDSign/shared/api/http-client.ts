import axios from 'axios';

// Пути запросов абсолютные (/proxy/...) — проксирует сервер хостинга,
// поэтому baseURL не задаём. Интерцепторов нет намеренно.
export const httpClient = axios.create();
