flowchart TB
    subgraph Inputs["Input Sources"]
        C[Conversations]
        H[Health Data]
        T[Tool Usage]
    end

    subgraph Vault["Knowledge Management System"]
        subgraph Active["Active Layer"]
            DL[Daily Logs]
            CI[Current Insights]
            AS[Active Sessions]
            subgraph Metadata["Enhanced Metadata"]
                EC[Effectiveness Metrics]
                TC[Training Categories]
                PF[Privacy Flags]
                QM[Quality Markers]
            end
        end

        subgraph Consolidated["Consolidated Layer"]
            subgraph Clusters["Topic Clusters"]
                BP[Behavioral Patterns]
                TP[Tool Patterns]
                SP[Success Patterns]
            end
            
            subgraph Synthesis["Synthesized Knowledge"]
                GT[Growth Trajectory]
                CG[Current Goals]
                CS[Core Strategies]
            end
        end

        subgraph Training["Training Archive"]
            subgraph Pairs["Conversation Pairs"]
                IP[Input/Response]
                CO[Coaching Outcomes]
            end
            
            subgraph Examples["Training Examples"]
                PR[Pattern Recognition]
                TU[Tool Usage]
                IN[Interventions]
            end
            
            subgraph Context["Historical Context"]
                HC[Historical Data]
                MB[Major Breakthroughs]
                LS[Learned Strategies]
            end
        end

        subgraph System["System Configuration"]
            PC[Processing Controls]
            CF[Config Settings]
            TL[Tool Links]
        end
    end

    C --> DL
    H --> DL
    T --> DL
    
    DL --> CI
    CI --> BP
    CI --> TP
    CI --> SP
    
    BP --> GT
    TP --> CS
    SP --> MB
    
    GT --> HC
    MB --> LS
    
    AS --> IP
    AS --> CO
    
    BP --> PR
    TP --> TU
    CS --> IN

    classDef input fill:#b3e0ff,stroke:#0066cc,color:#000
    classDef active fill:#e6b3ff,stroke:#6600cc,color:#000
    classDef consolidated fill:#b3ffb3,stroke:#006600,color:#000
    classDef training fill:#ffd9b3,stroke:#cc6600,color:#000
    classDef system fill:#d9ffb3,stroke:#66cc00,color:#000
    classDef metadata fill:#ffb3d9,stroke:#cc0066,color:#000
    
    class C,H,T input
    class DL,CI,AS active
    class BP,TP,SP,GT,CG,CS consolidated
    class IP,CO,PR,TU,IN,HC,MB,LS training
    class PC,CF,TL system
    class EC,TC,PF,QM metadata
