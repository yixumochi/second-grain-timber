# Defect → rule → evidence matrix

2026-09-23 · RESEARCH ONLY。这里的“存在数值规则”不表示已为库存选定分级标准。S 编号见 [SOURCE_REGISTER](SOURCE_REGISTER.md)。

PLIB No.17 (2018) 为**历史方法参照**；不能当成 No.18 (2024) 当前全文。当前 NLGA 2025 及 2026 Supplement No.1 的有关条文另列。不得混合不同规则集的有利条款。数值只在 [code map](SEATTLE_RECLAIMED_TIMBER_CODE_MAP.md) 中给少量经核对例子；本表不创建统一缺陷容差。

状态缩写（完整 enum 与字段文档一致）：A=AVAILABLE_NOW；P=APPROXIMATE_AVAILABLE；V=NEEDS_NEW_CV；M=NEEDS_MANUAL_INSPECTION；G=NEEDS_CERTIFIED_GRADING；E=NEEDS_ENGINEERING_ANALYSIS；X=NOT_OBTAINABLE_FROM_SELLER_IMAGES。V 表示未来可能提取候选，**不表示已实现**。所有缺陷当前均没有已验证的量测。

| 特征 | 控制类型 / 规则与确切定位 | 应观察 / 测量 / 单位 | 位置、面依赖 | 数值规则？ | 当前 evidence | 缺失证据与未来取得方法 | 决策层 |
|---|---|---|---|---|---|---|---|
| decay / rot 腐朽 | CODE_DIRECT S01 p.23-2 / S02 §2303.1.1.3；GRADING_RULE S12 §708 p.316；S18 §1.17 p.11 | 状况、范围、表面与内部检查依据；区域/长度 mm（须校准） | 全材；隐藏面/端面/内部须明确未检 | 旧料条款无容差；普通等级有特定允许条件，不能覆盖旧料前提 | A 来源；condition UNKNOWN | V 表面候选；M 检查；X 隐蔽/内部无腐朽不能由本组 RGB 建立 | 资格 + 分级 |
| knots 节子 | GRADING_RULE S10 §201a–d pp.221–222；S17 §320b pp.219–222、NGR §1.9 pp.7–12；S18 §121a p.4 | 两面平行边线间尺寸、窄面置换、品质/类型、间距；in/mm、截面比 | 宽/窄面、边缘/中心、沿长度组合；规则依产品分类 | 有；依 grade/nominal size，不能用同一圆直径 | A RGB追溯；P 候选面；尚无 knot detector | V 标注节区；M 校准与两面对应；G 等级判断 | 分级 |
| checks 表面干裂 | GRADING_RULE S10 §202 pp.223–225；S11 §121-c p.72、§123-c p.81；S18 §§121a/124c pp.4/9 | 表面轨迹、贯入深度、相对两面、是否端部贯通；mm/in | 面法向深度和端部位置；B&S/P&T 方法不同 | 部分等级 seasoning checks 不限；端部贯通按 splits；不能推出所有裂缝不限 | P 残差仅几何诊断 | V 表面裂纹候选；M 深度/贯通/类别；G 规则解释 | 分级 + 工程 |
| splits 劈裂 | GRADING_RULE S10 §202(d) p.225；S11 §121-c p.72、§123-c p.81；S18 p.9 | 从端部沿边方向延伸，深度/贯通；mm/in | 端面、相邻面；需要真实端点 | 有；依产品、等级，勿把裂纹像素长当实长 | A 图像；未测 | V 轨迹；M 实长与贯通；G | 分级 |
| shakes 轮裂 | GRADING_RULE S10 §202 pp.223–224；S18 §§121a/124c pp.4/9 | 木材年轮间分离类型、surface/through、范围；mm/in | 端面及各长面；是否端部贯通、沿材长区段 | 有；2026 更新，旧版长度条款不可直接移植 | UNKNOWN | V 候选；M 端面/贯通；G | 分级 |
| holes 一般孔洞 | GRADING_RULE S12 §716 p.320；S13 holes pp.2–3；S18 pp.4–10 | 类型、孔口尺寸、面积等效、个数/分布、是否穿透；mm/in、mm²、count | 最不利面、纵向分布、截面占用 | 有；规则和 grade/size/孔类有关；2026 frequency 有修订 | UNKNOWN | V 孔口；M 深度/成因/贯通；G 判类别，必要 E | 分级 + 净截面 |
| previous fastener holes 旧钉/螺栓/螺钉孔 | GRADING_RULE 一般 holes 可相关；NDS_DESIGN S19 §3.1.2 p.14；具体旧孔统一豁免阈值 NOT_FOUND | 孔口、轴/深度、残留金属、群孔、剩余韧带、裂缝；mm | 材端/边、临界截面、新连接/承压位置 | 无已确认“旧孔小于 X 忽略”通则 | UNKNOWN | V 可见孔口；M 探查/量测；E 净截面/连接；G 分级影响 | 分级 + 构件/连接 |
| notches / existing joinery 缺口/旧榫 | NDS_DESIGN S06 §4.4.3 p.32；S19 §§3.1.2/3.4.3 pp.14/18；ENGINEERING_JUDGMENT | 宽深长、开口/贯通、剩余断面；mm、mm² | 支承端/跨内、受拉/受压边、荷载方向 | 部分 beam notch 有 d 比限值；不是任意 mortise 许可 | P proxy 不是净截面 | V 区域；M 完整形状；E 缺口/净截面/连接分析 | 构件 |
| wane 钝棱 | GRADING_RULE S12 §750 p.330；S11 §§121-c/123-c pp.73/82；S17 §750 | 各面缺宽/缺厚、纵向区间及面边界；mm、比值 | 每面/角，端部、长度分布 | 有，依等级；不能用 missing pixels 当 wane | P 部分面范围 | V 可见边界；M 尺度及所有相关面；G | 分级 + 净截面 |
| slope of grain 斜纹 | GRADING_RULE S10 §203 p.226；S12 §712(b) p.318；S11 §§121-c/123-c pp.72/81 | 纤维相对材边方向的 run/rise；1:n | 足够测长、真实纤维方向、多面 | 有；Stud 与 No.2 等级不同 | 未提取 | V 纹理线仅候选；M 区分纤维与生长轮/锯痕；G | 分级 |
| missing section 断面缺失 | NDS_DESIGN S19 §3.1.2 p.14；GRADING_RULE S12 §750 条件适用 | 缺失体积边界、截面A/I/S、沿长变化；mm/mm²/mm³/mm⁴ | 临界截面与受力轴；所有相关面 | 净截面有计算要求；无通用损失百分比 | P 模型不完整；missing_material UNKNOWN | M 全断面/校准；E 净截面和偏心；X 缺视图不能判实缺料 | 构件 |
| crushing / local damage 压坏/局损 | ENGINEERING_JUDGMENT；NDS_DESIGN S19 §3.10 pp.23–24；S13 compression wood p.2（不可等同压坏） | 压溃、纤维断裂、凹陷、承压区实际面积；mm/mm² | 旧/新支承与连接；纤维方向 | bearing 设计有规则；服役旧损伤统一量化阈值 NOT_FOUND | UNKNOWN | V 候选；M 触查与范围；E 残余承载 | 资格 + 构件 |
| bow 平弯 | GRADING_RULE S12 §752(a) pp.330–331 | 相对端点直线的最大 flatwise 偏移与测长；mm | 完整两端/基线/截面方向 | 有，按等级及宽厚长查 warp 表 | P residual ≠ bow；字段 UNKNOWN | M 校准直尺/扫描；G；不可直接用 VGGT 残差 | 分级 + 几何适配 |
| crook 顺弯 | GRADING_RULE S12 §752(b) pp.331–332 | 最大 edgewise 偏移和测长；mm | 材边、两端和测量姿态 | 有，依尺寸/长度/等级 | UNKNOWN | M 直线基准；G | 分级 + 几何适配 |
| twist 扭曲 | GRADING_RULE S12 §752(d) pp.332–333 | 相对规定平面/支点的角翘起距离；mm，非只报旋转角 | 四角和完整长度、规定支承 | 有，依面宽/长/等级 | UNKNOWN | M 可控支承+量测；G | 分级 + 几何适配 |
| cup / combined warp 瓦弯/组合翘曲 | GRADING_RULE S12 §752(c) p.332、§752 p.330 | 宽度方向凹曲偏移与面宽；mm；组合情况 | 横向截线、所有相关面 | 有 cup 表；组合效应仍需判断 | UNKNOWN | M 校准截面与姿态；G | 分级 |
| moisture 含水率 | NDS_DESIGN S06 §§4.1.4/4.3.3 pp.26/28；GRADING_RULE S18 §44 pp.1–4 | 测试时MC、仪器/位置/时间、设计服役环境；% | 局部/深部和环境，旧戳是历史证据 | NDS dry service ≤19%；长期更湿核 CM，不是一般材料拒收值 | 无实测MC | M 含水率仪/其他适当方法；E 服役条件；X 当前RGB不能量测MC | 属性调整 |
| species 树种/树种组 | CODE_DIRECT S01 §2303.1.1/.1/.3；NDS_DESIGN S06 §4.1.2；S07 Table4A | 原文件/实体对应、商业树种组、规则依据 | 整根身份，表面/end-grain可辅助 | 无 RGB 置信度→物种认证阈值 | seller信息仅 SELLER_REPORTED | M/G 树种确认；CV可提候选；代码假定单独保存 | 分级 + 属性 |
| grade mark / certificate 等级证据 | CODE_DIRECT S01 §§2303.1.1/.1 p.23-1；S22 ALSC名单；S06 §4.1.2 p.26 | 戳原图/OCR、grade、agency、mill、species、历史MC、证书适用件/版本 | 对应同一实体、切割继承和现状 | 认可/范围规则，不是数值图像阈值 | 原图可追溯；本次无已核认证据 | V OCR；M 核真；G 签发/重分级；E/AHJ 接受与用途 | 资格 + 分级 |

## 使用这张表的顺序

先补 **身份、名义/真实尺寸、检查覆盖与 condition**，因为它们决定走哪条规则；再围绕具体 grading 路径提取特征。孔洞检测器可以帮助人找到孔，不能同时替人决定孔类、内部延伸、等级和净截面强度。以下都不成立：CV confidence→grade confidence；残差→bow；未重建区域→缺材；未检测到腐朽→devoid of decay。

本表的 HUMAN REVIEW 标签是研究需求建议。只有原文明确规定的认证/设计要求才标为规范义务；“拍所有面、保存 provenance、保留 UNKNOWN”等是为避免本项目证据混用而提出的记录设计。
