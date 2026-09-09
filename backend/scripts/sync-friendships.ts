/**
 * 存量好友关系同步脚本：
 * 把已有用户的同部门关系补齐为双向好友（幂等，可重复执行）。
 * 运行：npm run db:sync-friendships
 */
import { syncAllFriendships } from '../src/lib/friendship.js';

const created = await syncAllFriendships();
console.log(`[sync-friendships] 完成：新增好友关系 ${created} 条（已存在的跳过）`);
