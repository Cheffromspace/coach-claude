flowchart TB
    subgraph Inputs["Input Sources"]
        C[Conversations]
        H[Health Data]
        T[Tool Usage]
    end

    subgraph Vault["Knowledge Management System"]
        subgraph Notes["Note Management"]
            DL[Daily Logs]
            IN[Insights]
            RF[Reflections]
        end

        subgraph Organization["Knowledge Organization"]
            subgraph Tags["Tag System"]
                CT[Content Tags]
                TT[Tool Tags]
                PT[Progress Tags]
            end
            
            subgraph Links["Link System"]
                RL[Related Notes]
                TL[Tool Links]
                CL[Context Links]
            end
        end

        subgraph Tools["Knowledge Tools"]
            subgraph Core["Core Operations"]
                CR[Create]
                ED[Edit]
                SR[Search]
            end
            
            subgraph Discovery["Discovery Tools"]
                TS[Tag Search]
                PS[Pattern Search]
                CS[Content Search]
            end
            
            subgraph Connection["Connection Tools"]
                LK[Link Notes]
                TG[Tag Notes]
                RD[Related Discovery]
            end
        end

        subgraph Config["System Configuration"]
            CF[Config Settings]
            TD[Tool Definitions]
            MT[Metadata Templates]
        end
    end

    C --> DL
    H --> DL
    T --> DL
    
    DL --> IN
    IN --> RF
    
    IN --> CT
    T --> TT
    RF --> PT
    
    IN --> RL
    T --> TL
    DL --> CL
    
    CR --> Notes
    ED --> Notes
    SR --> Discovery
    
    TS --> Tags
    PS --> Links
    CS --> Notes
    
    LK --> Links
    TG --> Tags
    RD --> Links

    classDef input fill:#b3e0ff,stroke:#0066cc,color:#000
    classDef notes fill:#e6b3ff,stroke:#6600cc,color:#000
    classDef org fill:#b3ffb3,stroke:#006600,color:#000
    classDef tools fill:#ffd9b3,stroke:#cc6600,color:#000
    classDef config fill:#d9ffb3,stroke:#66cc00,color:#000
    
    class C,H,T input
    class DL,IN,RF notes
    class CT,TT,PT,RL,TL,CL org
    class CR,ED,SR,TS,PS,CS,LK,TG,RD tools
    class CF,TD,MT config

%% Knowledge Structure Notes:
%% 1. Note Management: Basic building blocks
%%    - Daily Logs: Regular activity tracking
%%    - Insights: Key learnings and observations
%%    - Reflections: Deeper understanding development
%%
%% 2. Knowledge Organization: Flexible structure
%%    - Tags: Simple categorization system
%%    - Links: Basic relationship tracking
%%    - Organic organization through usage
%%
%% 3. Knowledge Tools: Simple, composable operations
%%    - Core Operations: Basic note handling
%%    - Discovery Tools: Finding information
%%    - Connection Tools: Building relationships
%%
%% 4. System Configuration: Basic setup
%%    - Settings: System configuration
%%    - Tools: Available operations
%%    - Templates: Basic structure guides
