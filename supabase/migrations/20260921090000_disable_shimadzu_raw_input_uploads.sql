-- 原始工作簿只保留在用户浏览器。本迁移阻止新建或更新 shimadzu-inputs 对象，
-- 但不删除历史对象；既有保留任务仍由既有清理流程按期限处理。
begin;

drop policy if exists shimadzu_inputs_insert_owner on storage.objects;
drop policy if exists shimadzu_inputs_update_owner on storage.objects;

commit;
