// Stub cho "server-only" trong test — package thật throw() vô điều kiện khi
// import ngoài pipeline build của Next.js (Next tự alias nó thành no-op khi
// build server bundle; Vitest không có bước đó). Không export gì, chỉ để
// import "server-only" không crash khi chạy test.
export {};
