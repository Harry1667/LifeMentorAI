 1. 建表：在 aaPanel PostgreSQL 執行 02-web/src/lib/supabase/schema.sql（已寫好，直接貼上去執行）                                                                            
  2. 確認 Python Bridge 在跑：                              
  curl http://127.0.0.1:8765/health                                                                                                                                           
  3. 測試完整流程：登入 → 對話 → 到 DB 查 SELECT * FROM memories; 確認有寫入 → 重新整理頁面再對話，看導師是否引用過去記憶        


  你需要做的：

  1. 先啟動 Bridge（在你的 terminal 執行）：
  cd /Users/harryhwa/Documents/0-Dev/0-WebDev/5-LifeMentorAI/01-dev/use_proxycli
  python3.11 -m uvicorn server:app --host 127.0.0.1 --port 8765
  2. 然後在另一個 terminal（或等它啟動後）確認有沒有跑起來：
  curl http://127.0.0.1:8765/health
  2. 應該回傳 {"status":"ok"}