flowchart TD
    User[User Interface] --> CM[Conversation Manager]
    
    subgraph KnowledgeSystem[Knowledge Management System]
        subgraph CoreTools[Core Knowledge Tools]
            NO[Note Operations]
            TG[Tag Management]
            LK[Linking Tools]
            SR[Search & Retrieval]
        end

        subgraph Knowledge[Knowledge Store]
            NT[Notes]
            MT[Metadata]
            TG2[Tags]
            RL[Relationships]
        end
    end

    subgraph ProcessingSystem[Processing System]
        subgraph Tools[Tool Processing]
            MP[Message Processor]
            TP[Tool Handler]
            CP[Context Processor]
        end

        subgraph Search[Search & Discovery]
            PS[Pattern Search]
            TS[Tag Search]
            CS[Content Search]
        end
    end

    subgraph ConfigSystem[System Configuration]
        SP[System Prompts]
        CF[Config Settings]
        TL[Tool Definitions]
    end

    CM --> CoreTools
    CM --> Tools
    
    CoreTools --> Knowledge
    Tools --> Knowledge
    Search --> Knowledge
    
    ProcessingSystem --> KnowledgeSystem
    ConfigSystem --> ProcessingSystem
    
    subgraph DataFlow[Data Flow]
        direction LR
        I[Input] --> P[Processing] --> S[Storage] --> D[Discovery]
    end

    classDef tools fill:#e6b3ff,stroke:#6600cc,color:#000
    classDef knowledge fill:#b3ffb3,stroke:#006600,color:#000
    classDef processing fill:#b3e0ff,stroke:#0066cc,color:#000
    classDef config fill:#d9ffb3,stroke:#66cc00,color:#000
    
    class NO,TG,LK,SR tools
    class NT,MT,TG2,RL knowledge
    class MP,TP,CP,PS,TS,CS processing
    class SP,CF,TL config

%% Architecture Notes:
%% 1. Core Tools: Simple, composable operations for knowledge management
%%    - Note creation and editing
%%    - Tag management
%%    - Link creation and management
%%    - Search and retrieval
%%
%% 2. Knowledge Store: Basic storage with flexible organization
%%    - Notes: Primary content storage
%%    - Metadata: Basic tracking information
%%    - Tags: Flexible categorization
%%    - Relationships: Simple link tracking
%%
%% 3. Processing System: Streamlined tool handling
%%    - Tool Processing: Basic operation handling
%%    - Search & Discovery: Simple but effective search capabilities
%%
%% 4. Data Flow: Organic knowledge building
%%    Input → Processing → Storage → Discovery
%%    Emphasizes natural knowledge accumulation and discovery
