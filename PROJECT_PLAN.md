# Operation: Find [User] - Project Plan

## Overview
An interactive "witness board" knowledge graph where Nuix colleagues can submit sightings and theories about the user's whereabouts during leave. Each witness becomes part of the investigation graph, creating an evolving narrative visualization.

## Concept
- **Theme**: Missing person investigation / witness pinboard
- **OOO Message**: "STATUS: MISSING. Last seen [date]. If you have information on my whereabouts, please submit a witness statement: [website]"
- **Core Experience**: Visitors submit witness statements → Claude processes and extracts entities → Graph grows in real-time with witnesses, locations, activities, and connections
- **Key Rule**: If someone reports a sighting, they become a node in the graph as an investigator/witness

## User Requirements
- Host on appropriate Nuix domain
- Work appropriate content only (Claude moderates)
- Docker-based deployment (K8s available but starting with Docker)
- Use Anthropic Claude API for NLP processing
- Use Ogma (Linkurious) for graph visualization
- Real-time updates so multiple visitors see graph grow live
- No manual updates needed while on leave - fully autonomous

## Target Audience
- Nuix Ventures team colleagues
- Internal company audience familiar with investigation/eDiscovery concepts
- Tech-savvy users who appreciate clever technical implementations

## Success Criteria
- Colleagues can easily submit witness statements
- Graph visualization is compelling and grows organically
- Submissions are moderated for work-appropriateness
- System runs autonomously for duration of leave
- Creates a fun artifact to review upon return
- Witnesses feel invested by being part of the graph

## Constraints & Guardrails
- Must filter inappropriate content via Claude
- Should handle contradictory/absurd submissions gracefully
- Graph should remain readable as it grows (clustering, layout algorithms)
- Mobile-responsive for phone access
- No personal/sensitive data storage beyond work-appropriate witness statements
