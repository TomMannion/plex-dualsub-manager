# Bulk Dual Subtitle Creation - Technical Implementation Plan

## Overview

Implementation plan for bulk dual subtitle creation feature that allows users to create dual subtitles for entire TV shows with a seamless, language-intent-first user experience.

## User Experience Flow

### 1. Entry Point
- **Location**: Show detail page (`/shows/{showId}`)
- **Trigger**: "Create Bulk Dual Subtitles" button/card
- **Placement**: Alongside existing show actions, prominent but not overwhelming

### 2. Four-Step Wizard Interface
```
Step 1: Language Discovery & Selection
Step 2: Episode Preview & Configuration  
Step 3: Batch Processing with Progress
Step 4: Results Summary & Next Actions
```

## Technical Architecture

### Backend API Requirements

#### New Endpoints Needed:

1. **GET `/api/shows/{showId}/subtitle-analysis`**
   ```typescript
   interface SubtitleAnalysis {
     total_episodes: number;
     language_availability: {
       [languageCode: string]: {
         name: string;
         episodes_available: number;
         episodes_with_external: number;
         episodes_with_embedded: number;
         episode_details: Array<{
           episode_id: string;
           season_episode: string;
           title: string;
           has_external: boolean;
           has_embedded: boolean;
           embedded_streams?: Array<{
             stream_index: number;
             language_code: string;
           }>;
         }>;
       };
     };
   }
   ```

2. **POST `/api/shows/{showId}/bulk-dual-subtitle`**
   ```typescript
   interface BulkDualSubtitleRequest {
     primary_language: string;
     secondary_language: string;
     styling_config: DualSubtitleConfig;
     episode_selections: Array<{
       episode_id: string;
       primary_source: 'external' | 'embedded';
       secondary_source: 'external' | 'embedded';
       primary_stream_index?: number;
       secondary_stream_index?: number;
       skip?: boolean;
     }>;
   }
   
   interface BulkDualSubtitleResponse {
     job_id: string;
     estimated_duration: number;
   }
   ```

3. **GET `/api/jobs/{jobId}/status`**
   ```typescript
   interface JobStatus {
     status: 'pending' | 'running' | 'completed' | 'failed';
     progress: {
       total_episodes: number;
       completed_episodes: number;
       current_episode?: string;
       estimated_remaining: number;
     };
     results?: {
       successful: Array<{
         episode_id: string;
         output_file: string;
       }>;
       failed: Array<{
         episode_id: string;
         error: string;
       }>;
       skipped: Array<{
         episode_id: string;
         reason: string;
       }>;
     };
   }
   ```

### Frontend Components

#### 1. BulkDualSubtitleWizard Component
- **Location**: `src/components/BulkDualSubtitleWizard.tsx`
- **Purpose**: Main wizard container with step management
- **Props**: `showId`, `onComplete`, `onCancel`

#### 2. Step Components

##### Step 1: LanguageDiscoveryStep
```typescript
interface LanguageDiscoveryStepProps {
  analysis: SubtitleAnalysis;
  onLanguageSelect: (primary: string, secondary: string) => void;
  selectedPrimary?: string;
  selectedSecondary?: string;
}
```

**Features**:
- Display language availability statistics
- Smart suggestions based on most common languages
- Visual indicators for coverage (22/24 episodes)
- Language search/filter capability

##### Step 2: EpisodePreviewStep
```typescript
interface EpisodePreviewStepProps {
  analysis: SubtitleAnalysis;
  primaryLanguage: string;
  secondaryLanguage: string;
  onEpisodeConfigChange: (episodeId: string, config: EpisodeConfig) => void;
  episodeConfigs: Map<string, EpisodeConfig>;
}
```

**Features**:
- Episode-by-episode preview
- Source strategy display (external vs embedded)
- Individual episode overrides
- Skip/include toggles
- Conflict resolution UI

##### Step 3: ProcessingStep
```typescript
interface ProcessingStepProps {
  jobId: string;
  onComplete: (results: JobStatus['results']) => void;
}
```

**Features**:
- Real-time progress updates
- Current episode processing indicator
- Estimated time remaining
- Cancel operation capability
- Error handling during processing

##### Step 4: ResultsStep
```typescript
interface ResultsStepProps {
  results: JobStatus['results'];
  onViewEpisode: (episodeId: string) => void;
  onRetryFailed: (episodeIds: string[]) => void;
  onClose: () => void;
}
```

**Features**:
- Success/failure summary
- Detailed episode-level results
- Links to view created dual subtitles
- Retry failed operations
- Download/export options

#### 3. Supporting Components

##### LanguageAvailabilityCard
- Visual representation of language coverage
- Progress bars for availability
- Source type breakdown (external/embedded)

##### EpisodeConfigCard
- Individual episode configuration
- Source selection dropdowns
- Preview of what will be created
- Skip/override controls

##### ProcessingProgressCard
- Progress visualization
- Current operation display
- Performance metrics
- Error/warning indicators

## UI/UX Implementation Details

### Step 1: Language Discovery UI
```
┌─ Language Discovery ────────────────────────┐
│                                             │
│ Analyzing 24 episodes of "Attack on Titan" │
│                                             │
│ Most Available Languages:                   │
│ ┌─ English ──────────── 24/24 ─ 100% ─┐   │
│ │ 🗂️  20 external  📺 4 embedded      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─ Japanese ─────────── 22/24 ─ 92% ──┐   │
│ │ 🗂️  18 external  📺 4 embedded      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ Primary:   [English ▼]                     │
│ Secondary: [Japanese ▼]                    │
│                                             │
│ [Continue →]                                │
└─────────────────────────────────────────────┘
```

### Step 2: Episode Preview UI
```
┌─ Episode Configuration ──────────────────────┐
│                                              │
│ Creating English + Japanese dual subtitles  │
│                                              │
│ ✅ 20 episodes ready (both languages)       │
│ ⚠️  2 episodes need attention               │
│ ❌ 2 episodes will be skipped               │
│                                              │
│ ┌─ Episodes Needing Attention ─────────────┐ │
│ │ S01E03 "First Battle"                   │ │
│ │ Japanese: Extract from embedded stream  │ │
│ │ [Auto-extract] [Skip episode] [Manual] │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Styling: [Same as single episode UI]        │
│                                              │
│ [← Back] [Start Processing →]               │
└──────────────────────────────────────────────┘
```

### Step 3: Processing UI
```
┌─ Creating Dual Subtitles ───────────────────┐
│                                             │
│ Progress: 8/24 episodes (33%)               │
│ ████████░░░░░░░░░░░░░░░ Estimated: 4m 32s   │
│                                             │
│ Currently processing:                       │
│ S01E08 "The Basement"                       │
│ → Extracting Japanese from stream 3...     │
│                                             │
│ Recently completed:                         │
│ ✅ S01E07 "The Coordinate"                  │
│ ✅ S01E06 "The World Inside the Walls"     │
│ ✅ S01E05 "First Battle"                   │
│                                             │
│ [Cancel Processing]                         │
└─────────────────────────────────────────────┘
```

### Step 4: Results UI
```
┌─ Bulk Processing Complete ──────────────────┐
│                                             │
│ 🎉 Successfully created 20/24 dual subs    │
│                                             │
│ ✅ Successful: 20 episodes                  │
│ ⚠️  Failed: 2 episodes                     │
│ ⏭️  Skipped: 2 episodes                    │
│                                             │
│ ┌─ Failed Episodes ─────────────────────┐   │
│ │ S01E15 "Those Who Can Fight"         │   │
│ │ Error: Japanese subtitle extraction   │   │
│ │ failed - corrupted embedded stream    │   │
│ │ [Retry] [Manual Upload] [Skip]        │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ [View All Episodes] [Create More] [Done]    │
└─────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Backend Foundation
- [ ] Create subtitle analysis endpoint
- [ ] Implement bulk processing job system
- [ ] Add job status tracking
- [ ] Create batch dual subtitle creation logic
- [ ] Add error handling and recovery

### Phase 2: Core Components
- [ ] BulkDualSubtitleWizard container
- [ ] LanguageDiscoveryStep component
- [ ] Episode analysis and display logic
- [ ] Language selection UI with smart defaults

### Phase 3: Configuration & Preview
- [ ] EpisodePreviewStep component
- [ ] Episode-level configuration options
- [ ] Source strategy visualization
- [ ] Conflict resolution UI
- [ ] Styling configuration integration

### Phase 4: Processing & Results
- [ ] ProcessingStep with real-time updates
- [ ] Job status polling and management
- [ ] Progress visualization
- [ ] ResultsStep with detailed feedback
- [ ] Retry and error recovery options

### Phase 5: Integration & Polish
- [ ] Add entry point to show detail page
- [ ] Integration with existing components
- [ ] Error boundary implementation
- [ ] Loading states and optimizations
- [ ] User testing and refinements

### Phase 6: Advanced Features
- [ ] Resume interrupted jobs
- [ ] Export/import configurations
- [ ] Batch operation history
- [ ] Performance optimizations
- [ ] Advanced filtering options

## Technical Considerations

### Performance
- Use React Query for efficient data fetching and caching
- Implement virtual scrolling for large episode lists
- Debounce configuration changes
- Optimize re-renders with React.memo and useMemo

### Error Handling
- Graceful degradation for partial failures
- Clear error messages with actionable solutions
- Retry mechanisms for transient failures
- Rollback capabilities for interrupted operations

### Accessibility
- Keyboard navigation through wizard steps
- Screen reader support for progress indicators
- High contrast mode compatibility
- Focus management during step transitions

### Testing Strategy
- Unit tests for all components
- Integration tests for wizard flow
- Mock API responses for development
- E2E tests for complete user journey

## Success Metrics

### User Experience
- Time to complete bulk operation
- Error recovery success rate
- User completion rate (start to finish)
- Repeat usage patterns

### Technical Performance  
- API response times
- Processing speed per episode
- Memory usage during batch operations
- Error rate and types

This plan provides a comprehensive roadmap for implementing a user-friendly bulk dual subtitle creation feature that handles the complexity behind a simple, intuitive interface.