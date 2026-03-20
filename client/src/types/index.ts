// --- Detected Tasks (Intelligens Feladatfelismerés) ---

export interface DetectedTask {
  id: string;
  accountId: string;
  emailId: string;
  threadId: string | null;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  emailDate: number | null;
  detectionType: 'unread' | 'unanswered';
  reason: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'done' | 'dismissed' | 'snoozed';
  snoozedUntil?: number | null;
  createdAt: number;
  updatedAt?: number;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  lastSyncAt: number | null;
  color?: string | null;
  accountColor?: string | null;
}

export type SwipeAction = 'delete' | 'archive' | 'read' | 'star' | 'snooze' | 'none';

export interface UserSettings {
  swipeLeftAction?: SwipeAction;
  swipeRightAction?: SwipeAction;
  undoSendDelay?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursWeekendOnly?: boolean;
  desktopNotificationsEnabled?: boolean;
  vipNotificationsOnly?: boolean;
  notificationSoundEnabled?: boolean;
  toolbarActions?: string[];
  theme?: 'light' | 'dark' | 'system';
  messageDensity?: 'compact' | 'normal' | 'comfortable';
  conversationView?: boolean;
  accountColors?: Record<string, string>;
  accountSignatures?: Record<string, string>;
}

export interface Email {
  id: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  fromName: string | null;
  to: string | null;
  cc: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments: boolean;
  categoryId: string | null;
  topicId: string | null;
  // RĂ©szletes nĂ©zetnĂ©l
  body?: string | null;
  bodyHtml?: string | null;
  attachments?: Attachment[];
  // Unified inbox-hoz
  accountId?: string;
  accountEmail?: string;
  accountColor?: string;
}

export interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  gmailAttachmentId: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
  is_system?: number;
  description?: string | null;
  sort_order?: number;
  emailCount?: number;
}

export interface CategorizationRule {
  id: string;
  categoryId: string;
  type: 'sender_domain' | 'sender_email' | 'subject_keyword' | 'label';
  value: string;
  priority: number;
}

export interface SenderGroup {
  id: string;
  email: string;
  name: string | null;
  domain: string | null;
  messageCount: number;
  lastMessageAt: number | null;
}

export interface Topic {
  id: string;
  name: string;
  normalizedSubject: string;
  messageCount: number;
}

export interface TimePeriod {
  id: string;
  name: string;
  from: number;
  to: number;
  count: number;
}

export interface SessionInfo {
  authenticated: boolean;
  accounts: Account[];
  activeAccountId: string | null;
}

export interface PaginatedEmails {
  emails: Email[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Contact {
  id: string;
  email: string;
  name: string | null;
  frequency: number;
  lastUsedAt: number;
}

export interface DatabaseStats {
  totalEmails: number;
  totalContacts: number;
  totalAttachments: number;
  totalCategories: number;
  totalSenderGroups: number;
  totalTopics: number;
  databaseSizeBytes: number;
  oldestEmail: number | null;
  newestEmail: number | null;
  emailsByAccount: Array<{ accountId: string; email: string; count: number }>;
}

export interface DatabaseEmail {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  date: number;
  is_read: number;
  has_attachments: number;
  body_size: number;
}

export interface Backup {
  filename: string;
  path: string;
  size: number;
  createdAt: number;
}

// --- Melléklet AI elemzés ---
export interface AttachmentAnalysis {
  summary: string;
  keyPoints: string[];
  documentType: string;
  pageCount: number | null;
}

export interface AttachmentWithEmail {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  gmailAttachmentId: string;
  type: string;
  emailSubject: string | null;
  emailFrom: string | null;
  emailDate: number;
}

export interface AttachmentListResult {
  attachments: AttachmentWithEmail[];
  total: number;
  page: number;
  totalPages: number;
  typeStats: Record<string, number>;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  icon: string;
  color: string;
  useCount: number;
  createdAt: number;
}

export interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  shortcut: string | null;
  useCount: number;
  createdAt: number;
}

export interface SnoozedEmail {
  id: string;
  emailId: string;
  snoozeUntil: number;
  createdAt: number;
}

export interface Reminder {
  id: string;
  emailId: string;
  remindAt: number;
  note: string | null;
  isCompleted: boolean;
  createdAt: number;
  email?: Email;
}

export interface NewsletterSender {
  id: string;
  email: string;
  name: string | null;
  isMuted: boolean;
  emailCount: number;
  lastEmailAt: number | null;
}

export interface NewsletterEmailsResult {
  emails: (Email & { newsletter_name?: string; is_muted?: number })[];
  total: number;
  page: number;
  totalPages: number;
}

export interface NewsletterStats {
  totalSenders: number;
  mutedSenders: number;
  activeSenders: number;
  totalEmails: number;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal: number;
  messagesUnread: number;
  color: {
    textColor: string;
    backgroundColor: string;
  } | null;
}

export interface ScheduledEmail {
  id: string;
  to: string;
  cc: string | null;
  subject: string | null;
  body: string | null;
  scheduledAt: number;
  status: 'pending' | 'sent' | 'failed';
  createdAt: number;
}

export interface VipSender {
  id: string;
  email: string;
  name: string | null;
  createdAt: number;
}

// Calendar event
export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  htmlLink: string | null;
  colorId: string | null;
  status: string | null;
  hangoutLink: string | null;
  organizerEmail?: string | null;
  isOrganizer?: boolean;
}

// Google Task
export interface GoogleTask {
  id: string;
  title: string;
  notes: string | null;
  status: 'needsAction' | 'completed';
  due: string | null;
  completed: string | null;
  updated: string | null;
  position: string | null;
  parent: string | null;
}

// Task list
export interface TaskList {
  id: string;
  title: string;
  updated: string | null;
}

// Dashboard data
export interface DashboardData {
  unreadCount: number;
  todayEvents: Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
    isAllDay: boolean;
    location: string | null;
    htmlLink?: string | null;
    organizerEmail?: string | null;
    isOrganizer?: boolean;
  }>;
  todayEventsCount: number;
  openTasks: Array<{
    id: string;
    title: string;
    status: string;
    due: string | null;
    listId: string;
    listTitle: string;
    notes?: string | null;
    emailId?: string | null;
    accountId?: string | null;
    appLink?: string | null;
  }>;
  openTasksCount: number;
  actionCenter?: ActionCenterData;
  timestamp: number;
}

export type ActionCenterPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ActionCenterItem {
  id: string;
  kind:
    | 'action_item'
    | 'urgent_reply'
    | 'unread_email'
    | 'unanswered_email'
    | 'repeated_followup'
    | 'calendar_event'
    | 'event_candidate'
    | 'reminder'
    | 'google_task';
  sourceType:
    | 'action_items'
    | 'detected_tasks'
    | 'reminders'
    | 'calendar'
    | 'event_candidates'
    | 'google_tasks';
  title: string;
  summary: string | null;
  quote: string | null;
  priority: ActionCenterPriority;
  dueAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  status: string | null;
  confidence: number | null;
  suggestedAction: string | null;
  emailId: string | null;
  emailIds?: string[] | null;
  accountId: string | null;
  threadId: string | null;
  calendarEventId: string | null;
  groupSize?: number | null;
  links: {
    app: string | null;
    gmail: string | null;
    calendar: string | null;
  };
}

export interface ActionCenterData {
  generatedAt: number;
  blocks: {
    todayFocus: ActionCenterItem[];
    urgentClientMatters: ActionCenterItem[];
    unanswered: ActionCenterItem[];
    repeatedFollowUps: ActionCenterItem[];
    suggestedEvents: ActionCenterItem[];
    todayCalendar: ActionCenterItem[];
    delegatedWatch: ActionCenterItem[];
  };
}

export interface ActionableFeedItem {
  id: string;
  type: 'today_task' | 'urgent_reply' | 'unanswered_email' | 'deadline';
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  dueAt?: number | null;
  priority?: 'high' | 'medium' | 'low' | null;
  emailId?: string | null;
  threadId?: string | null;
  links: {
    app: string | null;
    gmail: string | null;
    calendar: string | null;
  };
  source: ActionCenterItem['sourceType'];
}

export interface DashboardFeed {
  generatedAt: number;
  blocks: {
    todayTasks: ActionableFeedItem[];
    urgentReplies: ActionableFeedItem[];
    unanswered: ActionableFeedItem[];
    deadlines: ActionableFeedItem[];
  };
}

// Thread conversation - teljes beszĂ©lgetĂ©s egy thread-ben
export interface ThreadEmail extends Email {
  isSent?: boolean;
  isDraft?: boolean;
}

export interface ThreadConversation {
  threadId: string | null;
  accountEmail: string | null;
  emails: ThreadEmail[];
}

// Market Analysis
export interface MarketRateInfo {
  pair: string;
  label: string;
  rate: number;
  change24h: number;
  changePercent: number;
  timestamp: string;
}

export interface MarketAnalysisItem {
  sourceId: string;
  source: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  pairs: string[];
  summary: string;
  keyLevel: string;
  outlook: string;
  confidence: number;
  weight: number;
  speciality: string;
  url: string;
  originalLanguage: string;
}

export interface MarketPositioningItem {
  pair: string;
  longPct: number;
  shortPct: number;
  bias: string;
  targetLow: number;
  targetHigh: number;
  support: number;
  resistance: number;
  catalyst48h: string;
  scenarioBull: string;
  scenarioBear: string;
}

export interface MarketNewsItem {
  title: string;
  source: string;
  originalLanguage: string;
  impact: 'Magas' | 'Közepes' | 'Alacsony';
  pairs: string[];
  summary: string;
  publishedAt: string;
  url?: string;
}

export interface MarketWeightedConclusion {
  direction: string;
  score: number;
  summary: string;
}

export interface MarketBriefingData {
  generatedAt: string;
  cached: boolean;
  rates: MarketRateInfo[];
  analyses: MarketAnalysisItem[];
  positioning: MarketPositioningItem[];
  newsItems: MarketNewsItem[];
  weightedConclusion: Record<string, MarketWeightedConclusion>;
  overallSentiment: string;
  isAIPowered: boolean;
  fallbackReason?: 'missing_api_key' | 'timeout' | 'generation_failed';
  fallbackMessage?: string;
}

export interface MarketBriefingResponse {
  success: boolean;
  data: MarketBriefingData;
}

// Deep Analysis types
export interface DeepAnalysisCurrencyDetail {
  trend: 'up' | 'down' | 'sideways';
  support: number;
  resistance: number;
  forecast: string;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
}

export interface DeepAnalysisGold {
  trend: string;
  forecast: string;
  recommendation: string;
}

export interface DeepAnalysisData {
  summary: string;
  currencies: Record<string, DeepAnalysisCurrencyDetail>;
  gold: DeepAnalysisGold;
  overallRecommendation: string;
  risks: string[];
  generatedAt: string;
  cached?: boolean;
  trendData?: TrendDataPoint[];
  rates?: MarketRateInfo[];
  isAIPowered?: boolean;
  fallbackReason?: 'missing_api_key' | 'timeout' | 'generation_failed';
  fallbackMessage?: string;
}

export interface DeepAnalysisResponse {
  success: boolean;
  data: DeepAnalysisData;
}

export interface TrendDataPoint {
  date: string;
  rates: Record<string, number>;
}

export interface TrendResponse {
  success: boolean;
  data: TrendDataPoint[];
}

// --- News (RSS) ---
export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet: string;
}

export interface NewsResponse {
  success: boolean;
  articles: NewsArticle[];
}

// --- Crypto (CoinGecko) ---
export interface CryptoPriceData {
  usd: number;
  eur: number;
  huf: number;
}

export interface CryptoPrices {
  bitcoin: CryptoPriceData;
  ethereum: CryptoPriceData;
}

export interface CryptoResponse {
  success: boolean;
  prices: CryptoPrices;
}

// --- Email Intelligence ---

export interface ActionItem {
  id: string;
  emailId: string;
  accountId: string;
  text: string;
  dueDate: number | null;
  sourceQuote?: string | null;
  priority?: 'high' | 'medium' | 'low';
  confidence?: number | null;
  suggestedAction?: string | null;
  workflowOrigin?: string | null;
  calendarEventId?: string | null;
  isDone: boolean;
  createdAt: number;
  updatedAt?: number | null;
}

export interface SentimentResult {
  success: boolean;
  sentiment: 'urgent' | 'positive' | 'negative' | 'neutral';
  confidence: number;
  reason: string;
}

export interface ReplySuggestion {
  tone: 'short' | 'medium' | 'detailed';
  subject: string;
  body: string;
}

export interface RelatedEmail {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  date: number;
  relevance: 'topic' | 'sender' | 'thread';
}

export interface WeeklyReportData {
  period: { from: number; to: number };
  totalEmails: number;
  unreadCount: number;
  topSenders: Array<{ email: string; name: string; count: number }>;
  topTopics: Array<{ subject: string; count: number }>;
  unansweredCount: number;
  sentimentBreakdown: { urgent: number; positive: number; negative: number; neutral: number };
  actionItemsPending: number;
  summary: string;
}

// --- Smart Folders ---

export interface SmartFolderRule {
  field:
    | 'from'
    | 'to'
    | 'subject'
    | 'labels'
    | 'has_attachments'
    | 'is_read'
    | 'date_age_days'
    | 'subject_or_snippet_keywords'
    | 'ai_tags_contains'
    | 'content_semantic'
    | 'unanswered';
  operator: 'contains' | 'equals' | 'not_contains' | 'greater_than' | 'less_than' | 'contains_any';
  value: string;
}

export interface SmartFolder {
  id: string;
  accountId: string;
  name: string;
  icon: string;
  rules: SmartFolderRule[];
  isSystem: boolean;
  sortOrder: number;
  emailCount?: number;
  createdAt: number;
  updatedAt: number;
}

// --- Analytics ---

export interface ResponseTimePoint {
  date: string;
  avgMinutes: number;
}

export interface CategoryBreakdown {
  name: string;
  count: number;
  color: string;
}

export interface PeriodComparison {
  label: string;
  current: number;
  previous: number;
}

export interface SenderRanking {
  email: string;
  name?: string;
  count: number;
}

export interface AnalyticsData {
  responseTimes: ResponseTimePoint[];
  categories: CategoryBreakdown[];
  comparison: PeriodComparison[];
  topSenders: SenderRanking[];
}

// --- Daily Brief ---

export interface DailyStats {
  received: number;
  replied: number;
  pending: number;
  date: string;
}

export interface PriorityEmail {
  id: string;
  subject: string;
  from: string;
  fromName?: string;
  receivedAt: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  reason?: string;
}

export interface FollowUp {
  id: string;
  emailId: string;
  subject: string;
  from_email: string;
  from_name: string;
  daysSince: number;
  urgency: string;
}

export interface ContactActivity {
  email: string;
  name?: string;
  count: number;
}

export interface DailyBriefData {
  stats: DailyStats;
  contacts: ContactActivity[];
}

// --- Workflow Run Logs ---

export interface RunLogEntry {
  id: string;
  workflowId: string;
  accountId: string;
  status: 'running' | 'completed' | 'failed';
  triggerEmailId: string | null;
  stepsCompleted: number;
  result: Record<string, unknown>;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

// --- Smart Search ---

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'ai';
}

export interface SmartSearchResult {
  query: string;
  interpretation: string;
  resultCount: number;
  emails?: Array<{
    id: string;
    subject: string | null;
    fromEmail: string | null;
    fromName: string | null;
    snippet: string | null;
    date: number;
    appLink: string;
  }>;
}

// --- AI Chat ---

export interface PendingAgentAction {
  toolName: 'saveWorkflow' | 'runWorkflow';
  title: string;
  confirmationMessage: string;
  payload: Record<string, unknown>;
}

export interface AgentExecutionResult {
  kind:
    | 'search'
    | 'workflow_draft'
    | 'workflow_saved'
    | 'workflow_run'
    | 'workflows'
    | 'smart_folders'
    | 'navigation'
    | 'email';
  title: string;
  query?: string;
  interpretation?: string;
  resultCount?: number;
  emails?: Array<{
    id: string;
    subject: string | null;
    fromEmail: string | null;
    fromName: string | null;
    snippet: string | null;
    date: number;
    appLink: string;
  }>;
  workflowDraft?: WorkflowData;
  workflow?: {
    id?: string;
    name: string;
    triggerType?: string;
    stepCount?: number;
    isActive?: boolean;
  };
  workflowRun?: {
    id: string;
    workflowId: string;
    status: string;
    triggerEmailId: string | null;
    stepsCompleted: number;
  };
  workflows?: Array<{
    id: string;
    name: string;
    triggerType: string;
    isActive: boolean;
    stepCount: number;
  }>;
  smartFolders?: Array<{
    id: string;
    name: string;
    color: string | null;
    count: number;
  }>;
  navigation?: {
    label: string;
    path: string;
  };
  warnings?: string[];
}

export interface AiAgentResponse {
  reply: string;
  conversationId: string | null;
  result?: AgentExecutionResult | null;
  pendingAction?: PendingAgentAction | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt?: number;
  createdAt: number;
}

// --- Workflows ---

export type WorkflowTriggerType = 'new_email' | 'schedule' | 'manual';

export type WorkflowStepType =
  | 'filter'
  | 'ai_analyze'
  | 'categorize'
  | 'label'
  | 'forward'
  | 'summarize'
  | 'extract'
  | 'notify'
  | 'group'
  | 'save_report'
  | 'ai_reply'
  | 'condition'
  | 'extract_action_items'
  | 'detect_followup_risk'
  | 'extract_calendar_event'
  | 'create_calendar_event'
  | 'raise_dashboard_alert';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name?: string;
  config: Record<string, unknown>;
}

export interface WorkflowData {
  id?: string;
  name: string;
  description?: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}
