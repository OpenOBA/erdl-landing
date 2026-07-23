<p align="center">
  <img src="https://raw.githubusercontent.com/openoba/erdl-spec/main/assets/erdl-logo.svg" alt="ERDL Logo" width="120" />
</p>

<h1 align="center">ERDL锛圗ntity-Rule Definition Language锛?/h1>

<p align="center">
  <strong>AI Agent 鐨勭‘瀹氭€ц涓鸿鍒欏眰銆備笉鏄?Prompt 宸ョ▼銆?/strong>
</p>

<p align="center">
  <a href="https://github.com/OpenOBA/erdl-landing/releases"><img src="https://img.shields.io/badge/Version-1.1%20Final-blue?style=flat-square" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Status-Frozen%20%26%20Audited-success?style=flat-square" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/Layer-L9%20Semantic-orange?style=flat-square" alt="Layer"></a>
</p>

<p align="center">
  <a href="#-quick-start">蹇€熷紑濮?/a> 鈥?  <a href="#-core-concepts">鏍稿績姒傚康</a> 鈥?  <a href="#-v11-highlights">v1.1 浜偣</a> 鈥?  <a href="#-compliance--audit">鍚堣涓庡璁?/a> 鈥?  <a href="#-ecosystem">鐢熸€?/a>
</p>

---

## 浠€涔堟槸 ERDL锛?
鍦?Agentic AI 鏃朵唬锛孡LM 鏄鐜囨€х殑锛岃€屼紒涓氱骇涓氬姟闇€瑕?*纭畾鎬?*銆?
**ERDL锛圗ntity-Rule Definition Language锛?* 鏄竴涓紑鏀剧殑銆佸０鏄庡紡鐨?Agent 琛屼负瑙勫垯鏍囧噯銆傚畠瀹氫箟浜?AI Agent 鍦ㄦ墽琛屽伐鍏疯皟鐢ㄦ椂蹇呴』閬靛惊鐨勭害鏉熴€佺瓥鐣ュ拰绾犲亸閫昏緫銆?
- 馃毇 **涓嶆槸 Prompt 宸ョ▼**锛歅rompt 鏄?寤鸿"锛孉gent 鍙兘浼氬够瑙夋垨缁曡繃銆侲RDL 鏄‘瀹氭€ф墽琛岄棬绂侊紝Agent 鏃犳硶缁曡繃銆?- 馃毇 **涓嶆槸 Agent 妗嗘灦**锛欵RDL 涓嶅彇浠?LangGraph銆丆rewAI 鎴?AutoGen銆傚畠鏄繖浜涙鏋剁己澶辩殑**瑙勫垯娌荤悊灞?*銆?- 鉁?**L9 璇箟瑙勫垯灞?*锛欵RDL 濉ˉ浜?MCP锛圠8锛屽伐鍏疯繛鎺ワ級鍜?A2A锛圠8锛孉gent 閫氫俊锛変箣闂寸殑娌荤悊绌虹櫧銆?
### 涓夊眰鍗忚鏍?
```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? A2A 鈥?Agent →Agent 閫氫俊鏍囧噯 (L8)                鈹? Google 路 Linux Foundation
鈹溾攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? ERDL 鈥?Agent 琛屼负瑙勫垯鎻忚堪璇█ (L9)               鈹? OpenOBA 路 MIT License
鈹? (MCP Server + A2A Card Extension)                鈹? <--- 浣犲湪杩欓噷
鈹溾攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? MCP 鈥?Agent →Tool 杩炴帴鏍囧噯 (L8)                 鈹? Anthropic 路 Linux Foundation
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

---

## 蹇€熷紑濮?
ERDL 瑙勫垯浣跨敤 YAML 缂栧啓鈥斺€斾汉绫诲拰 LLM 閮芥槗璇汇€?
### 1. 缂栧啓绗竴鏉¤鍒?
```yaml
# rules/security.yaml
# 闃绘闈?DBA 浜哄憳鍒犻櫎鐢熶骇鏁版嵁搴?- name: "SEC-001-protect-prod-db"
  description: "淇濇姢鐢熶骇鐜鏁版嵁搴撲笉琚鍒?
  priority: 100
  category: security

  # unless 璞佸厤锛坴1.1锛氫紭鍏堣瘎浼帮紝鐭矾姹傚€硷級
  unless:
    logic: AND
    conditions:
      - field: "caller.role"
        operator: eq
        value: "DBA_ADMIN"

  # 瑙﹀彂鏉′欢
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "execute_sql"
      - field: "tool.args.query"
        operator: match
        value: "(?i)DROP\\s+TABLE"

  # 纭畾鎬у姩浣?  then: DENY

  # 寮哄埗鍙嶉锛坴1.1锛氭寚瀵?LLM 鑷垜绾犳锛?  message: "DROP TABLE 宸叉嫤鎴€傝浣跨敤 data_archive_tool 鎴栬仈绯?DBA 鍥㈤槦銆?
```

### 2. 楠岃瘉瑙勫垯

```bash
# 瀹夎 CLI
npm install -g @openoba/erdl-engine-js

# 杩愯璐ㄩ噺闂ㄧ妫€鏌?erdl-lint check ./rules/
```

杈撳嚭绀轰緥锛?```
鉁?SEC-001-protect-prod-db: Passed (Determinism, Completeness)
鈿?SEC-002-api-rate-limit: Warning [empty-message-on-blocking-rule]
  闃绘柇绫昏鍒欑己灏?message 瀛楁锛孡LM 灏嗘棤娉曠悊瑙ｆ嫆缁濆師鍥犮€?```

---

## 鏍稿績姒傚康

| 姒傚康 | 璇存槑 |
|------|------|
| **13 绉嶈繍绠楃** | `eq` `ne` `gt` `gte` `lt` `lte` `in` `not_in` `contains` `not_contains` `match` `exists` `within` |
| **17 绉?Then 鍔ㄤ綔** | `ALLOW` `CORRECT` `NOTIFY` `DENY` `EMERGENCY_HALT` `ROLLBACK` `QUARANTINE` `REQUEST_HUMAN` `ESCALATE` `DELEGATE` `STRATEGIZE` `AUDIT` `CALCULATE` `VALIDATE` `WORKFLOW` `WORKFLOW_WAITING` `WORKFLOW_PROGRESS` |
| **4 绾ф墽琛岀幆** | Ring 0锛堝畨鍏級→Ring 1锛堝悎瑙勶級→Ring 2锛堣繍钀ワ級→Ring 3锛堟墽琛岋級 |
| **44 鏉￠獙璇佸悜閲?* | 37 鍐崇瓥寮曟搸 + 7 瀹¤鍝堝笇 = 璺ㄥ疄鐜伴€愬瓧鑺備竴鑷?|
| **JCS + SHA-256 瀹¤閾?* | RFC 8785 瑙勮寖鍖栧簭鍒楀寲锛岄槻绡℃敼銆佸彲杩芥函 |

馃搫 瀹屾暣瑙勮寖锛歔English](spec/erdl-spec-v1.1.en.md) | [涓枃鐗圿(spec/erdl-spec-v1.1.md)

---

## v1.1 鏍稿績浜偣

v1.1 鏄熀浜庣湡瀹炰紒涓氱骇 Agent 鐢熶骇鐜鐥涚偣鎵撶（鐨勯槻寰℃€х増鏈細

| 鐗规€?| 璇存槑 | 瑙ｅ喅鐨勭棝鐐?|
|------|------|-----------|
| **unless 鐭矾璞佸厤** | unless 璇勪及浼樺厛浜?when锛屾敮鎸佸畨鍏ㄧ殑绌哄€间紶鎾?| 瑙ｅ喅"涓€鍒€鍒?鎷︽埅锛屾敮鎸佺櫧鍚嶅崟/榛戝悕鍗曠瓑澶嶆潅涓氬姟閫昏緫 |
| **寮哄埗 message 绾犲亸** | 闃绘柇绫昏鍒欙紙DENY/CORRECT锛夊繀椤绘惡甯︾粨鏋勫寲鍙嶉 | 瑙ｅ喅 Agent 琚嫤鎴悗"涓嶇煡閬撲负浠€涔?瀵艰嚧鐨勬寰幆鎴栧够瑙?|
| **璐ㄩ噺闂ㄧ** | 鍔犺浇鏃惰嚜鍔ㄦ嫤鎴?`when: 'true'` + `DENY` 绛夊嵄闄╄鍒?| 闃叉鍗曟潯閿欒瑙勫垯瀵艰嚧鏁翠釜 Agent 绯荤粺鍋滄憜 |
| **JCS+SHA-256 瀹¤閾?* | Decision Object 閲囩敤 RFC 8785 瑙勮寖鍖栧簭鍒楀寲 | 纭繚璺ㄨ瑷€銆佽法骞冲彴鐨勫璁℃棩蹇楀叿澶囨瘮鐗圭骇涓€鑷存€?|
| **缁撴瀯鍖栧懡鍚嶈鑼?* | 寮哄埗 `[CAT]-[NNN]-鎻忚堪` 鏍煎紡 | 灏嗚鍒欎粠"涓存椂鑴氭湰"鍗囩骇涓轰紒涓氱骇"鍙璁¤祫浜? |

> 瀹屾暣鍙樻洿鍙傝 [CHANGELOG.md](CHANGELOG.md)

---

## 鍚堣涓庡璁?
ERDL 涓嶄粎浠呮槸鎶€鏈伐鍏凤紝鏇存槸浼佷笟 AI 娌荤悊鐨勫悎瑙勫熀纭€璁炬柦銆倂1.1 鐨?Decision Object 鍜屽璁¤瘉鎹摼璁捐锛岀洿鎺ュ榻愪互涓嬪浗闄?鍥藉唴鏍囧噯锛?
- 馃嚜馃嚭 **EU AI Act (Art. 15)**锛氭弧瓒抽珮椋庨櫓 AI 绯荤粺鐨勯€忔槑搴︺€佸彲瑙ｉ噴鎬т笌浜哄伐鐩戠潱瑕佹眰
- 馃嚭馃嚫 **NIST AI RMF 1.0**锛氭彁渚?Measure/Map 闃舵鎵€闇€鐨勯噺鍖栭闄╃鎺у嚟璇?- 馃嚚馃嚦 **GB/Z 185-2026**锛氬榻愩€婁汉宸ユ櫤鑳?鏅鸿兘浣撲簰鑱斻€嬪浗瀹舵爣鍑嗕腑鐨勮涓哄璁′笌瀹夊叏鏉℃
- 馃彚 **淇￠€氶櫌銆屽彲淇?AI 2.0銆?*锛氳鐩?鍏抽敭鑳藉姏-鍐崇瓥"涓?骞冲彴鏀拺"缁村害鐨勮瘎浼拌姹?
> 馃挕 瀵逛簬 RegTech锛堢洃绠＄鎶€锛夊紑鍙戣€咃細ERDL 鐨?Decision Object 鏄満鍣ㄥ彲璇荤殑娉曞畾璇佹嵁鏍煎紡銆傛偍鍙互鐩存帴瑙ｆ瀽 ERDL 瀹¤鏃ュ織锛岃嚜鍔ㄧ敓鎴愬悎瑙勬姤鍛娿€?
---

## 鐢熸€侀泦鎴?
ERDL 鍧氭寔妗嗘灦鏃犲叧鍘熷垯銆傛垜浠紦鍔辩ぞ鍖烘瀯寤哄悇绉?Runner銆両DE 鎻掍欢鍜屼腑闂翠欢锛?
- **LangChain / LangGraph**锛氫綔涓?Tool Router 鐨?Middleware 娉ㄥ叆
- **CrewAI / AutoGen**锛氫綔涓?Agent 瀹炰緥鍖栨椂鐨?Guard 灞?- **MCP锛圡odel Context Protocol锛?*锛欵RDL 瑙勫垯鍙嚜鍔ㄧ紪璇戜负 MCP Server锛屼緵浠讳綍 MCP Client 璋冪敤
- **IDE 鏀寔**锛氱ぞ鍖洪┍鍔ㄧ殑 VS Code 鎻掍欢锛圷AML 琛ュ叏銆丩int 鎻愮ず銆乀race 鍙鍖栵級

---

## 璺嚎鍥撅紙v1.2锛?
ERDL v1.1 宸插喕缁撱€倂1.2 灏嗛噸鐐硅В鍐冲垎甯冨紡涓庨珮绾ф不鐞嗗満鏅細

| 浼樺厛绾?| 鐗规€?| 璇存槑 |
|:---:|------|------|
| 馃敶 P0 | 鍒嗗竷寮忎竴鑷存€?| 璺ㄨ妭鐐?EMERGENCY_HALT 鍏ㄥ眬鐢熸晥涓庣姸鎬佸悓姝?|
| 馃煛 P1 | Message 妯℃澘鎻掑€?| 鏀寔 `{{context.amount}}` 绛夊姩鎬佸彉閲忔敞鍏ョ籂鍋忎俊鎭?|
| 馃煛 P1 | 鑷畾涔夎川閲忛棬绂?| 鍏佽浼佷笟閫氳繃鎻掍欢鎵╁睍 `erdl-lint` 瑙勫垯 |
| 馃煛 P1 | DELEGATE 鍐崇瓥绫诲瀷 | 姝ｅ紡鏀寔澶?Agent 闂寸殑鏉冮檺濮旀墭瀹¤ |

> 瀹屾暣 v1.2 瑙勫垝瑙?[闄勫綍 E](spec/erdl-spec-v1.1.md#闄勫綍-ev12-瑙勫垝鐩爣)

---

## 鍙備笌璐＄尞

ERDL 鏄竴涓敱绀惧尯椹卞姩鐨勪腑绔嬫爣鍑嗐€傛杩庝互涓嬪舰寮忕殑璐＄尞锛?
- **鎻愪氦瑙勫垯妯″紡**锛氬湪 `examples/` 鐩綍璐＄尞鐗瑰畾琛屼笟锛堥噾铻嶃€佸尰鐤椼€佸埗閫狅級鐨勬渶浣冲疄璺佃鍒欓泦
- **鏋勫缓宸ュ叿閾?*锛氬紑鍙戦拡瀵圭壒瀹氳瑷€锛圧ust銆丟o銆丳ython锛夌殑 SafeExpr 瑙ｆ瀽鍣ㄦ垨 IDE 鎻掍欢
- **瀹屽杽娴嬭瘯鍚戦噺闆?*锛氬湪 `spec/vectors/` 涓ˉ鍏呰竟缂樺満鏅祴璇曠敤渚?
---

## 璁稿彲璇?
ERDL 瑙勮寖鍩轰簬 [MIT License](LICENSE) 寮€婧愩€?
> 纭畾鎬ф灦鏋勶紝鑰岄潪 Prompt 宸ョ▼銆?> OpenOBA 路 2026
