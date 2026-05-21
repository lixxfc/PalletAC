# PalletAC 项目快照备忘

> 这是给 Claude 接续上下文用的项目备忘。
> 用法:在新的 Cowork session 里把这个文件拖进去,让 Claude 读完后就能直接接上之前的工作。
> 项目所有者:Michael Harreds(harreds.ceo@gmail.com)
> 公司:CYPP UK LTD
> 业务:托盘批发(从 SSS 进货,分销给客户)

---

## 1. 项目本质

一套两件套 Web app(纯 HTML + JS + Supabase),管理托盘批发生意的所有账目:
- **个人 App** (`personal/index.html`) — Michael 的客户账(销售 / 客户预付 / INV 发票)
- **合伙账 App** (`index.html`) — Michael / Emma / Hugo 的合伙账(SSS 池 / 现金流 / 合伙发票)

部署:**GitHub Pages**,网址 `https://lixxfc.github.io/PalletAC/` 和 `/personal/`
后端:**Supabase**(项目 URL `https://vnuyvrgtraougqspgpmz.supabase.co`)
邮件:**Resend**(通过 Supabase Edge Function `send-document`)
代码仓库:**github.com/lixxfc/PalletAC**

---

## 2. 业务背景(关键!)

### 老模式(已弃用,2026-05-20 之前)
- 资金流向:Michael → Emma → SSS
- Michael 把钱转给 Emma,Emma 替 Michael 付 SSS,Michael 再去 SSS 拉货
- 合伙账三人共享(Michael / Emma / Hugo 都能看到 partnership_data)

### 新模式(2026-05-20 切换,当前在用)
- 资金流向:**客户 + Emma → Michael → SSS** + Michael → Hugo
- 客户预付 Michael(£265/托)、Emma 转 Michael(£245/托,她自己取货用的)
- Michael 把钱(自己的 + Emma 的 + 客户的)统一付给 SSS
- Hugo 提成由 Michael 给现金,**Emma 跟 Hugo 自己结**(Emma 自己取的托盘的 Hugo 提成由她自己处理,不上 Michael 的账)

### 价格体系(只在个人 App 维护,合伙账只读同步)
- 买价(SSS):**£245/托**
- 卖价(客户):**£265/托**(普通)
- Swap TT 溢价:**+£30/托** → 卖价 £295
- Michael 中介费:£31/托
- Hugo 提成:**£7/托**
- V 费用:£2/托(客户直接付 V,过路费)

### Swap 含义
跟 Emma 换 — 比如 Emma 取了一车 TT 但客户要 AMZ,她跟 Michael 换:Michael 给客户 TT(收 £295)+ Michael 拿 Emma 那车 AMZ。合伙账层面不区分 Swap(SSS 都是 £245),Swap 溢价只影响个人 App 的客户销售。

---

## 3. 账目模型 - Option B(用户 2026-05-20 确认)

**Emma 的"切换日预付"包含两部分:**
1. 切换那天 SSS 池里 Emma 出的钱(£3,170 — 老模式池子全是 Emma 出的)
2. Michael 当时欠 Emma 的钱(£5,145)

→ Emma 切换日预付 = £3,170 + £5,145 = **£8,315**

存在 `state.params.emmaOpeningCredit = 8,315`(正数 = Emma 的 SSS 池预付信用)。

**Michael 的切换日 SSS 份额** = SSS 总池 − Emma 预付 = 3,170 − 8,315 = **−£5,145**(透支,正常)。

**还款方式**:Emma 通过取货消化她的预付信用,不需要 Michael 现金还。

### 当前数字快照(2026-05-20 18:00 左右)
- SSS 总池:£27,935
- 我的 SSS 份额(Michael):£18,375(够拉 75 托)
- Emma 的 SSS 份额:£9,560(够拉 39 托)
- Emma 余额(在我这):£9,560
- Hugo 应付:£2,541 + 24 × £7 = £2,709(假设 5/20 那 24 TT 是 Michael 的)
- 资金池余额:−£29,400(因为 Michael 今天自掏 £29,400 给 SSS)
- 累计入金:£5,655(Emma £5,655 + 客户 £0)
- 累计出金:£35,055(SSS £35,055 + Hugo £0)

---

## 4. 文件结构

```
palletac/                         # = GitHub repo 根
├── index.html                    # 合伙账 app
├── personal/
│   └── index.html                # 个人客户账 app
├── edge-functions/
│   └── send-document.ts          # Supabase Edge Function(邮件中继)
└── supabase/
    └── rls-private-mode.sql      # RLS 锁定 SQL(用户已在 2026-05-20 之后某时跑过)
```

工作电脑本地路径:
`/Users/michael/Library/Application Support/Claude/local-agent-mode-sessions/eb2cdb13-56f1-4d5e-88ae-a9552fbedac5/d307a4a0-9c05-4429-8a11-06761104d77f/local_9298fdfc-a6bc-4f87-b1d4-93e817c398b6/outputs/palletac/`

MacBook 上 clone:`git clone https://github.com/lixxfc/PalletAC.git`

---

## 5. Supabase 表结构

### `partnership_data`
- `workspace_id` (PK, 固定 = 'main')
- `data` jsonb — 整个合伙账 state(events / params / company / emma / hugo / sss / partnershipInvoices)
- `updated_at`
- **RLS**:私人模式锁定后,只有 Michael (`harreds.ceo@gmail.com`) 能读写

### `personal_data`
- `user_id` (FK to auth.users)
- `data` jsonb — 整个个人 state(customers / dailySupply / invoices / receipts / params)
- `updated_at`

### Edge Function `send-document`
- 部署在 Supabase
- 需要 secret: `RESEND_API_KEY = re_a5JJuo6s_51F719APbDSRx9KTGFq28rtu`
- ALLOWED_USERS:harreds.ceo@gmail.com / emma@maomail.uk / ukhugo@outlook.com
- 用途:发 INV / REC / SINV / PINV / 对账单邮件,from `onboarding@resend.dev`

---

## 6. 关键数据模型

### state.events (合伙账)
事件流水,每条一个 event:
- `type`: `'pickup' | 'transfer' | 'in-emma' | 'in-customer' | 'out-supplier' | 'out-hugo'`
- `date`: ISO yyyy-mm-dd
- `pallets`(只有 pickup 有)
- `amount`
- `palletType`: `'TT' | 'AMAZON' | 'Mixed'`
- `pickedUpBy`: `'Michael' | 'Emma'`(新加字段,优先于 createdBy)
- `createdBy`: 邮箱(老字段,fallback)
- `_linkSupplyId`: UUID,用于跨表匹配 personal 的 truck
- `deleted` / `deletedAt` / `deletedBy`:软删除

### state.dailySupply (个人 App)
按 (date + pickupBy) 分组的每日供货记录:
- `id`, `date`, `pickupBy`, `manualOverride`, `trucks: []`, `note`, `createdAt`
- `trucks[i]`: `{ type, pallets, swapped, note, pickedUpBy?, _linkSupplyId }`
- **同一天可以有多条**(Michael 一条 + Emma 一条)— 由 (date + pickupBy) 唯一标识

### state.partnershipInvoices(合伙账)
- SINV-Emma:Emma 转钱时自动开,粉色模板
- PINV-SSS:Michael 付 SSS 时自动开,紫色模板

### state.customers[].ledger (个人 App)
- `{ type: 'pickup' | 'deposit' | 'refund', date, amount, pallets?, ... }`
- 自动开 INV (pickup) / REC (deposit)

---

## 7. 双向跨表同步

**核心原则:任何一边录入或修改,另一边自动同步。**

### 个人 App 录入 → 合伙账
- `saveSmartPickup` 函数:写 dailySupply + 写 partnership_data.events
- `saveUnifiedInEmma / saveUnifiedOutSupplier / saveUnifiedOutHugo`:写 partnership_data 事件 + 自动开 SINV / PINV
- `saveUnifiedInCustomer`:写 customer ledger + 自动开 REC(partnership 通过 fetchPersonalCustomerCache 读到)

### 合伙账修改 → 个人 App
- `reassignPickupOwner(id)`:翻转事件归属 + 调用 `_syncPickupOwnerToPersonal`
- `resyncPickupToPersonal(id)`:仅同步(不翻转)— 修历史数据用
- `_syncPickupOwnerToPersonal`:按 (date + _linkSupplyId + type + pallets) 匹配并移动 truck

### 个人 App 修改 → 合伙账
- `saveSupply`:保存时收集 `trucksToSyncToPartnership` → 调用 `pushTruckOwnersToPartnership`
- `pushTruckOwnersToPartnership`:按相同 key 匹配 partnership event,更新 pickedUpBy / createdBy

---

## 8. UI 关键功能位置

### 合伙账 App (`index.html`)
- **仪表盘**:5 KPI(资金池 / SSS 总池 / Emma / Hugo / 本月)+ "SSS 池分配明细"卡(Michael vs Emma 份额 + 预警)
- **转账记录**:新模式下旧表单锁定,显示 "去个人 App"
- **取货记录**:每行有 **→Emma/→Michael**(翻转 + 同步)和 **🔄**(仅同步)按钮
- **发票 / 凭证**:SINV / PINV tab,可打印 + 发邮件 + 作废
- **设置**:
  - 业务参数(新模式只读,在个人 App 改)
  - **🛠 切换日期初余额**(可调整 sssOpening / emmaOpening / hugoOpening)
  - Emma / Hugo / SSS 联系信息

### 个人 App (`personal/index.html`)
- **仪表盘**:有大按钮 **⚡ 今日录入**(5 合 1 hub)
  - 取货 / Emma 转你 / 客户付款 / 付 SSS / 付 Hugo
  - 取货 tab 支持 Emma 模式(不分配客户、不开 INV)
- **每日供货**:
  - 上方 4 KPI + 本周明细柱状图(按 owner + 类型分色,4 datasets)
  - 表格按 (date, owner) 一行一行显示(同一天可两行)
  - 点 **✎ 改** 进供货编辑器:每车单独"归属"下拉(Michael / Emma),保存自动拆分
- **出货交易**:新增表单**锁定**,只读历史
- **客户账本**:正常,客户卡片网格
- **月度汇总**:8 周对比 + 星期规律图表

---

## 9. 已完成的 Phase 清单

- Phase 0:基础设施 + 切换按钮
- Phase 1:5 KPI 卡 + 历史 / 新模式 toggle
- Phase 2:3 个新模式录入表单(已被 Phase 6 锁掉)
- Phase 3:SINV-Emma + PINV-SSS 系统(自动开 + 打印 + 邮件 + 作废)
- Phase 4:个人 App 智能录入支持 Emma 模式 + RLS SQL 脚本
- Phase 5:**待做** — 对账单 / 邮件模板按新模式重写
- Phase 6A:5 合 1 unified entry(个人 App 单一录入口)
- Phase 6B:合伙账旧表单新模式下只读
- Phase 6C:价格同步(个人 → 合伙)
- Phase 7:SSS 池分配明细卡片(per-party tracking + 预警)
- Phase 8:Emma 期初语义重构(Option B)

---

## 10. 已修复的关键 Bug

1. **`d-date` null reference** — 锁掉 出货交易 表单后,loadUserData 还在 `getElementById('d-date').value = ...`,导致 renderAll() 不跑,客户账本空白。已加 null-check。
2. **saveSmartPickup 强制覆盖 pickupBy** — 同一天已有 Michael 记录时,新录入 Emma 被静默覆盖成 Michael。已改成按 (date + pickupBy) 匹配,不同 owner 创建独立记录。
3. **consolidateDailySupplyDuplicates 错误合并** — 按 date 合并导致 Emma + Michael 同一天的记录被合到一起。已改成按 (date + owner) 去重。
4. **Emma 余额标签反了** — 显示 "她欠你"应该是"你欠她"。已修。
5. **合伙账反向同步缺失** — partnership 改归属时 personal 不动。已加 `_syncPickupOwnerToPersonal`。
6. **个人 App 改归属不同步合伙账** — 已加 `pushTruckOwnersToPartnership`(2026-05-20 最新)。
7. **每日供货图表 owner 不分** — 改成 4 datasets(Michael TT / Emma TT / Michael AMZ / Emma AMZ),每段柱子带 owner 标签。
8. **每日供货表格不分行** — 改成 (date, owner) 一行,同一天可两行,第二行用 ↳ 缩进。
9. **统一录入保存按钮卡住** — 保存成功关 modal 时按钮没重置 disabled,再开点不动。已在 closeSmartEntry 重置。

---

## 11. 未做的事(Pending)

### 优先级高
- **Phase 5**:对账单 / 邮件模板按新模式重写。Emma 对账单要按新模式逻辑(她的转账 → SSS 池 → 取货消化)。Hugo 对账单要清晰区分应付 / 已付。
- **总览卡片**:Michael 之前问过 "资金池 + 我的 SSS 份额 vs 客户账本" 的总览(显示是否够履约)— 可以加。

### 优先级中
- **AI 自然语言录入框**(任务 #43)— 仪表盘顶部
- **Smart Reminders Center**(任务 #44)— 仪表盘顶部
- **App 内周报**(任务 #45)— 右上角指示器

### 优先级低 / 维护
- 切换 modal 的提示文字进一步优化(2 个独立输入分别问 "Emma 老债" 和 "Emma 在池子里的钱")
- 自动检测两边数据不一致并提示

---

## 12. 用户偏好 / 重要约定

- **沟通语言**:中文(简体),但代码注释 + 标识符用英文
- **沟通风格**:Michael 偏好直接、详细、给具体 step-by-step,不喜欢长篇大论的概念解释除非必要
- **错误处理**:Michael 对数据丢失 / 显示错误很敏感(吓过一次客户账本空白),修复前先**搜索所有引用**,避免野指针
- **改动原则**:**任何改动都要全局生效** — 不能让用户两个地方手动改
- **价格信任源**:全部由个人 App 维护,合伙账只读同步
- **打印 / 邮件模板**:不漏银行信息(发出去前要 strip co.bank)
- **私人模式**:Emma / Hugo 不能看到 partnership_data(RLS 已锁)

---

## 13. 在新机器上接续步骤

1. `cd ~/Documents`(或任何地方)
2. `git clone https://github.com/lixxfc/PalletAC.git`
3. 开 Claude 桌面 app → Cowork 模式 → 新建 session
4. 把这个 `PROJECT-HANDOFF.md` 拖进对话
5. 告诉 Claude:"请读完这份备忘,然后告诉我项目当前状态。"
6. Claude 读完后,告诉它你现在想做什么(继续 Phase 5? Debug? 加新功能?)
7. 如果要改代码:让 Claude 用 git-aware 的方式工作(直接改本地 clone,然后 commit / push)

---

## 14. 紧急参考(常用 ID / URL)

- **Supabase project**:`vnuyvrgtraougqspgpmz`
- **Supabase URL**:`https://vnuyvrgtraougqspgpmz.supabase.co`
- **GitHub repo**:`https://github.com/lixxfc/PalletAC`
- **Live app**:`https://lixxfc.github.io/PalletAC/`
- **个人 App**:`https://lixxfc.github.io/PalletAC/personal/`
- **Michael 邮箱**:harreds.ceo@gmail.com
- **Emma 邮箱**:emma@maomail.uk
- **Hugo 邮箱**:ukhugo@outlook.com
- **Resend API key**:`re_a5JJuo6s_51F719APbDSRx9KTGFq28rtu`(secret,只放 Supabase Edge Function 环境变量里)

---

*备忘生成时间:2026-05-20*
*生成方:Claude(Cowork mode,工作电脑 session)*
*下次接续:在 MacBook 上的新 Cowork session 里拖入此文件*
