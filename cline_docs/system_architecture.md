flowchart TD
    User[User Interface] --> CM[Conversation Manager]
    
    subgraph KnowledgeSystem[Knowledge Management System]
        subgraph Active[Active Layer]
            CS[Conversation State]
            DL[Daily Logs]
            CI[Current Insights]
            MD[Enhanced Metadata]
        end

        subgraph Consolidated[Consolidated Layer]
            TC[Topic Clusters]
            SY[Synthesized Knowledge]
            PT[Personal Traits & Goals]
        end

        subgraph Training[Training Archive]
            CP[Conversation Pairs]
            TE[Training Examples]
            HC[Historical Context]
        end
    end

    subgraph ProcessingSystem[Processing System]
        subgraph Runtime[Runtime Processing]
            MP[Message Processor]
            TP[Tool Processor]
            CP2[Context Processor]
        end

        subgraph Consolidation[Consolidation Processing]
            PC[Pattern Clustering]
            KS[Knowledge Synthesis]
            TD[Training Data Preparation]
        end
    end

    subgraph ConfigSystem[System Configuration]
        SP[System Prompts]
        CF[Config Settings]
        TL[Tool Links]
    end

    CM --> Active
    CM --> Runtime
    
    Runtime --> Active
    Active --> Consolidated
    Consolidated --> Training
    
    ProcessingSystem --> KnowledgeSystem
    ConfigSystem --> ProcessingSystem
    
    subgraph DataFlow[Data Flow]
        direction LR
        I[Input] --> P[Processing] --> S[Storage] --> C[Consolidation]
    end

    classDef active fill:#e6b3ff,stroke:#6600cc,color:#000
    classDef consolidated fill:#b3ffb3,stroke:#006600,color:#000
    classDef training fill:#ffd9b3,stroke:#cc6600,color:#000
    classDef processing fill:#b3e0ff,stroke:#0066cc,color:#000
    classDef config fill:#d9ffb3,stroke:#66cc00,color:#000
    
    class CS,DL,CI,MD active
    class TC,SY,PT consolidated
    class CP,TE,HC training
    class MP,TP,CP2,PC,KS,TD processing
    class SP,CF,TL config
