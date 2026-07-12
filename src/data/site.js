import timelineData from '../../content/timeline.json';

const periopactMain = new URL('../../assets/site-shots/periopact-main.png', import.meta.url).href;
const huoziYinshua = new URL('../../assets/site-shots/huozi-yinshua.png', import.meta.url).href;
const pactView = new URL('../../assets/site-shots/pact-view.png', import.meta.url).href;
const periopactMobile = new URL('../../assets/site-shots/periopact-mobile.png', import.meta.url).href;
const annotationWorkbench = new URL('../../assets/site-shots/annotation-workbench.png', import.meta.url).href;

export const navItems = [
  { label: '网站入口', href: '/#tools' },
  { label: '历程', href: '/#timeline' },
  { label: '使用说明', href: '/blog/index.html' },
  { label: '反馈', href: '/#feedback' },
  { label: '联系方式', href: '/#contact' },
];

export const heroCopy = {
  badge: 'WXG · 工具与随笔',
  title: 'WXG 工具入口',
  subtitle: '请大家在此寻找对应网站及工具',
  note: '这里集中维护我做的几个在线工具，都可以直接在浏览器打开使用。之后这里也会陆续放上工具的更新记录、随笔博客和我的个人简历。',
  stats: [
    { value: '5', label: '在线工具' },
    { value: '0', label: '安装步骤' },
    { value: '全平台', label: '浏览器直接打开' },
  ],
};

export const toolSites = [
  {
    name: 'PerioPACT 主站',
    url: 'https://www.periopact.cn/',
    label: '临床系统',
    tagline: '牙周诊疗与随访管理的主工作区',
    audience: '牙周治疗、患者管理、随访记录',
    tags: ['患者档案', '疗程随访', '影像资料'],
    image: periopactMain,
    imagePath: 'assets/site-shots/periopact-main.png',
    description:
      '覆盖牙周诊疗全流程的工作台：患者档案、疗程计划、复查随访和影像资料集中在一处管理。日常临床工作请从这里进入。',
  },
  {
    name: '活字印刷',
    url: 'https://huozi-yinshua.pages.dev/',
    label: '内容制图',
    tagline: '把文字内容排成好看的分享图',
    audience: 'Markdown 排版、分享图生成',
    tags: ['Markdown', '自动排版', '一键出图'],
    image: huoziYinshua,
    imagePath: 'assets/site-shots/huozi-yinshua.png',
    description:
      '粘贴一段 Markdown 文字，即可生成适合微信、朋友圈等场景转发的排版图片。写科普材料、通知说明或轻量内容输出时很省事。',
  },
  {
    name: 'PACT View',
    url: 'https://pactviewbywxg.pages.dev/',
    label: '影像查看',
    tagline: '在浏览器里直接查看三维口腔影像',
    audience: 'CBCT、口扫、三维数据查看',
    tags: ['CBCT', '口扫模型', '三维演示'],
    image: pactView,
    imagePath: 'assets/site-shots/pact-view.png',
    description:
      '不用安装任何客户端，浏览器里直接加载 CBCT、口扫等三维数据，可旋转、缩放和演示，适合医患沟通和病例讨论时快速调出。',
  },
  {
    name: 'PerioPACT 移动端',
    url: 'https://www.periopact.cn/m',
    label: '移动入口',
    tagline: '为手机屏幕优化的 PerioPACT',
    audience: '手机访问、临时查看、移动场景',
    tags: ['移动优化', '诊间使用', '快速查阅'],
    image: periopactMobile,
    imagePath: 'assets/site-shots/periopact-mobile.png',
    description:
      '专为手机访问优化的 PerioPACT 入口。诊间、随访途中或临时需要查看患者信息时，用手机打开这个地址最方便。',
  },
  {
    name: '标注工作台',
    url: 'https://annotate.periopact.cn/',
    label: '数据标注',
    tagline: '多模态口腔文字标注工作台',
    audience: '口内照、CBCT、口扫、咬合分析标注',
    tags: ['多模态', '模板标注', 'JSON/TSV 导出'],
    image: annotationWorkbench,
    imagePath: 'assets/site-shots/annotation-workbench.png',
    description:
      '面向口腔多模态数据的文字标注工具：内置 22 类标注模板，覆盖口内照、CBCT、口扫与咬合分析，标注结果可一键导出 JSON / TSV，适合科研数据整理与样本标注。浏览器直接打开即用。',
  },
];

export const roadmap = [
  {
    step: '01',
    title: '团队工具入口',
    text: '现阶段的核心：把常用工具集中在一页，随时能找到、点开就能用。',
    status: '进行中',
  },
  {
    step: '02',
    title: '工具发布与更新日志',
    text: '新工具在这里发布，重要更新会写成简短的说明，方便大家了解变化。',
    status: '规划中',
  },
  {
    step: '03',
    title: '博客与个人简历',
    text: '之后会加入随笔博客和我的简历页，让这里慢慢长成一个完整的个人站点。',
    status: '规划中',
  },
];

// 历程时间轴：数据存放在 content/timeline.json，可在后台「历程」标签里增删改。
// status 用 'doing'（进行中，红点呼吸）或 'done'（已完成）；按数组顺序从上往下展示。
export const timeline = timelineData;

export const contacts = [
  { label: '手机号', value: '17658162159', href: 'tel:17658162159' },
  { label: '微信号', value: 'G241127N' },
  { label: '邮箱', value: 'w982378625@gmail.com', href: 'mailto:w982378625@gmail.com' },
  { label: 'GitHub', value: 'KINg-maxxx', href: 'https://github.com/KINg-maxxx' },
];
