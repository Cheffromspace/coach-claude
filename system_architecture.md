flowchart TD
    User[User Interface] --> CM[Conversation Manager]
    
    subgraph MemorySystem[Memory System]
        KG[Knowledge Graph]
        VM[Vector Memory/RAG]
        CS[Conversation State]
        PT[Personal Traits & Goals]
    end

    subgraph KB[Knowledge Base]
        SR[Scientific Research]
        BP[Best Practices]
        DK[Domain Knowledge]
    end

    subgraph Coach[Coach Personality]
        SP[System Prompt]
        PT2[Personality Traits]
        CG[Coaching Guidelines]
    end

    CM --> MemorySystem
    CM --> KB
    CM --> Coach
    
    KG --> CM
    VM --> CM
    CS --> CM
    PT --> CM
    
    SR --> CM
    BP --> CM
    DK --> CM
    
    SP --> CM
    PT2 --> CM
    CG --> CM