flowchart TB
    subgraph Inputs["Input Sources"]
        C[Conversations]
        H[Health Data]
        T[Tool Usage]
    end

    subgraph Vault["Obsidian Vault"]
        subgraph Daily["Daily Layer"]
            DL[Logs]
            DI[Insights]
            DR[Reflections]
        end

        subgraph Knowledge["Knowledge Base"]
            subgraph Patterns["Pattern Recognition"]
                BP[Behavioral Patterns]
                TP[Tool Patterns]
                SP[Success Patterns]
            end
            
            subgraph Profile["Personal Profile"]
                GT[Growth Trajectory]
                CG[Current Goals]
                CS[Core Strategies]
            end
            
            subgraph Archive["Deep Storage"]
                HC[Historical Context]
                MB[Major Breakthroughs]
                LS[Learned Strategies]
            end
        end

        subgraph System["System Config"]
            PR[Prompts]
            CF[Config]
            TL[Tool Links]
        end
    end

    C --> DL
    H --> DL
    T --> DL
    
    DL --> DI
    DI --> DR
    
    DR --> BP
    DR --> TP
    DR --> SP
    
    BP --> GT
    TP --> CS
    SP --> MB
    
    GT --> HC
    MB --> LS
    
    classDef input fill:#b3e0ff,stroke:#0066cc,color:#000
    classDef daily fill:#e6b3ff,stroke:#6600cc,color:#000
    classDef patterns fill:#b3ffb3,stroke:#006600,color:#000
    classDef profile fill:#ffd9b3,stroke:#cc6600,color:#000
    classDef archive fill:#ffb3d9,stroke:#cc0066,color:#000
    classDef system fill:#d9ffb3,stroke:#66cc00,color:#000
    
    class C,H,T input
    class DL,DI,DR daily
    class BP,TP,SP patterns
    class GT,CG,CS profile
    class HC,MB,LS archive
    class PR,CF,TL system
