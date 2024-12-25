**WHY – Vision & Purpose**

### **Purpose & Users**

**Porfin** helps businesses (including but not limited to health clinics) achieve better results by analyzing their customer journeys and automating key processes through AI. The system empowers users to create and manage **virtual assistants (agents)** that handle customer inquiries, schedule appointments, conduct sales, and more—all via WhatsApp. Users can opt for pre-defined agents or leverage **no-code / low-code tools** to build new agents with drag-and-drop.

We aim to **keep it simple** for this MVP phase. Although we want a polished design and functional features, **we won’t overcomplicate** the code for large-scale deployments just yet, given our limited user base. Over-optimizing for scalability at this stage can introduce unnecessary complexity and errors.

----------

## **WHAT – Core Requirements**

### **Functional Requirements**

The system, primarily in **Brazilian Portuguese**, must allow users to:

 1. **Register**

    - Users register using their email address (with password or Google Sign-In).

    - Users provide the name of their business or clinic (optional if not a clinic).

 2. **Connect their WhatsApp Accounts**

    - Integrate one or more WhatsApp Business accounts via a JavaScript microservice that uses **Baileys** (  
      <https://github.com/WhiskeySockets/Baileys> ) to connect with WhatsApp Web.

    - Integrate zero or more WhatsApp Business API accounts via another JavaScript microservice using the **official WhatsApp Platform API**.

    - Both microservices should be standalone (in JavaScript) to keep the architecture simple and modular.

 3. **Communicate Through a WhatsApp-like Interface**

    - Provide an interface for users to send and receive messages from their connected WhatsApp accounts.

    - In each chat, users can toggle on/off the capability for AI-powered agents to automatically respond.

 4. **Monitor Key Business Metrics**

    - Allow selection of time periods to view metrics such as:

      1. Number of chats

      2. Number of messages

      3. Response rate (% of chats with at least one customer response)

      4. Appointment rate (% of chats that resulted in an appointment)

      5. Average first response time

      6. Average time from first contact to appointment (for those who scheduled)

 5. **Track Customer Stages in a Sales Funnel**

    - Classify or tag customers as leads, waiting for first appointment, negotiating, under treatment, or post-treatment (configurable for non-healthcare contexts).

 6. **AI-Driven Time Series Analysis & Recommendations**

    - Provide AI-based insights on metrics.

    - For instance, if chat volumes are decreasing, the system suggests increasing marketing investment.

 7. **Pre-configured AI Agents + Custom No-Code Agents**

    - Offer a no-code environment (drag-and-drop) to build or customize LLM-powered virtual assistants.

    - Provide some **pre-defined** agents to showcase usage:

      1. **Assistente de Leads (Lead Assistant)**: Converts leads into appointments, optionally integrating with a calendar. If no calendar integration is available, notifies a human operator to schedule manually.

      2. **Assistente de Venda de Orçamento (Sales Assistant)**: Handles post-consultation sales, adept in negotiation and knowledge of product/service pricing, payment plans, discounts, etc. May integrate with payment gateways for PIX, barcode, or credit card payments.

    - Users can **rename agents, customize prompts**, and upload documents as agent knowledge bases.

 8. **Test & Iterate with Virtual Assistants**

    - Provide a simulation (mock chat) environment for each agent.

    - Users can input text, audio, images, or attachments to see how the agent responds.

    - Users can modify agent prompts and optionally supply additional context (like the customer’s name or chat history).

 9. **Campaign Management**

    - Display a list of campaigns with statuses: in-progress, draft, paused, or finished.

    - Allow pausing, editing, and resuming campaigns.

10. **Setup Communication Campaigns (Bulk Messages)**

    - Send mass WhatsApp messages at staggered intervals (randomly between 60 and 120 seconds).

    - Each campaign has a name and goal; the system generates a **Jinja**-style template using an LLM.

      1. Templates can pull variables like customer_name, clinic_name, doctor_name, etc.

    - Offer **ad-hoc (single)** or **recurring** campaigns.

      1. **Ad-hoc**: User picks a date or sends immediately.

      2. **Recurring**: Define a follow-up rule (e.g., send messages on days 0, 1, 3, 6, 10, 14, 19) until a user action occurs.

      3. Use chat context to decide whether sending a follow-up is appropriate (e.g., if the customer requested more time, wait before sending more follow-ups).

    - Segment and target groups based on funnel stages (or custom segments).

    - Provide a test WhatsApp number to validate campaigns before going live.

    - Upon campaign creation, show a celebratory animation to reward the user.

11. **Chatbot Flow Components**

    - **User Input**: Via text, voice, images, or documents (PDF, etc.).

    - **Input Processing**:

      1. **Multimodal to Text**: Convert voice or other input into text.

      2. **Activation Policy**: Decide if the AI agent should respond now (configurable by the user per assistant).

      3. **Comms DB**: Log/retrieve communication data.

    - **Natural Language Understanding (NLU)**:

      1. **Intent Recognition**

      2. **Entity Extraction**

      3. Potentially use CRM data for personalization.

    - **Dialog Management**:

      1. **Decide Agent** (e.g., Sales, Customer Service)

      2. **Decide Response** (could be null).

    - **Agents**: Specific modules (Sales, Customer Service, Billing, Feedback, Human Handoff).

    - **Docs & APIs**: Knowledge base for FAQ, instructions, booking, etc.

    - **Output Processing**:

      1. **Grammar Check**

      2. **Formatting**

      3. **Sanity Checks** (avoid loops or redundant replies).

    - **Response Delivery**:

      1. Send via the same channel (WhatsApp).

      2. Log to Comms DB.

      3. Avoid repetitive or infinite loops.

12. **Optional Integrations**

    - **Google Calendar**: Let AI agents book appointments (with date, time, duration, professional ID).

    - **CRM Solutions** in Brazil: RD Station, HubSpot.

    - **Dental-Specific CRMs** in Brazil: Clinicorp, EasyDental.

----------

## **HOW – Planning & Implementation**

### **Technical Implementation**

#### **Simplified, MVP-Focused Architecture**

We want a **straightforward** implementation with a nice UI, but **not** an overly complex infrastructure. This will allow us to move fast, validate our ideas, and avoid premature optimization for scale.

#### **Required Stack Components**

1. **Frontend**

   - Web app built in **Next.js** (React-based).

   - **Tailwind CSS** for styling.

   - **Framer Motion** for animations.

   - **Radix UI** for components.

   - Mobile-friendly or native app as a “nice-to-have” for on-the-go chats and calendar.

2. **Backend**

   - **Python-based FastAPI** as the main API layer (for user authentication, data management, AI logic orchestration).

   - **Firebase** for authentication, plus **Firestore** as the primary database for messages and user data.

   - **Metabase-compatible** database for analytics/monitoring (could mirror data from Firestore or store aggregated metrics).

3. **Integrations**

   - **JavaScript Microservice using Baileys** for WhatsApp Web connections ([GitHub repo](https://github.com/WhiskeySockets/Baileys)).

   - **JavaScript Microservice** for the **official WhatsApp Platform API**.

   - **OpenAI** (GPT-4 or GPT-4o) for LLM features.

   - **Google Calendar** for scheduling.

   - **Payment gateways** for Brazilian infrastructure (PIX, barcode, credit card).

4. **Infrastructure**

   - Hosted on **Google Cloud** (Compute Engine or Cloud Run).

   - Basic redundancy and fail-safes but no heavy multi-region scaling yet.

#### **System Requirements**

- **High performance** for real-time communication (avoid large overhead or complex sharding at MVP stage).

- **Secure authentication** and data handling (GDPR compliance where feasible).

- **Reliability** with minimal downtime (enough for an MVP, no need for multi-region replication if it complicates deployment).

----------

## **User Experience**

### **Key User Flows for Virtual Assistants**

1. **Setup and Customization**

   - **Entry Point**: “Virtual Assistants” tab → “Create New Assistant” or select an existing one.

   - **Steps**:

     1. Define the assistant’s purpose (Lead Assistant, Sales Assistant, or Custom).

     2. Customize the assistant’s name and prompt.

     3. Optionally upload documents (pricing tables, product details).

     4. Activate the assistant.

   - **Success**: Assistant is ready to handle real chats.

2. **Testing and Iteration**

   - **Entry Point**: “Virtual Assistants” tab → Select an assistant → “Test Assistant.”

   - **Steps**:

     1. Enter a simulation environment resembling WhatsApp.

     2. Send text, audio, or attachments.

     3. Adjust the agent’s prompt or context.

     4. Retest to confirm changes.

   - **Success**: Assistant responses are appropriate and tested.

3. **Daily Interaction**

   - **Entry Point**: Chat Interface or Virtual Assistants tab.

   - **Steps**:

     1. View ongoing conversations.

     2. Toggle AI replies on/off for specific chats.

     3. Let the agent handle routine tasks (e.g., scheduling, answering FAQs).

     4. Human operator can step in if needed.

   - **Success**: Agents reduce manual work while maintaining customer satisfaction.

4. **Performance Monitoring**

   - **Entry Point**: Virtual Assistants tab → “Analytics.”

   - **Steps**:

     1. View conversion rates, appointment rates, or sales closed.

     2. Receive recommendations to improve responses.

   - **Success**: Clear metrics that help users optimize their assistants.

### **Key User Flows for Metrics & Campaigns**

1. **Metrics Monitoring**

   - **Entry Point**: Dashboard.

   - **Steps**: Select time period → View key metrics → See AI-driven analysis.

   - **Success**: Actionable insights (e.g., if leads are dropping, system suggests improvements).

2. **Campaign Creation**

   - **Entry Point**: “Campaigns” tab in the Dashboard.

   - **Steps**:

     1. Define campaign (name, target audience, goal).

     2. System proposes a message template (Jinja-based).

     3. Configure either a single send (ad-hoc) or recurring rule.

     4. Preview with a test WhatsApp number.

     5. Activate and see a congratulatory animation.

   - **Success**: Bulk/automated messages sent smoothly, with appropriate follow-ups or recurrences.

----------

## **Core Interfaces**

1. **Dashboard**

   - Central hub for metrics, insights, and overall system health.

2. **Virtual Assistant Tab**

   - Create, customize, and monitor virtual assistants.

   - Offers a no-code drag-and-drop interface to build or tweak agent logic.

3. **Chat Interface**

   - Real-time messaging.

   - Toggle AI agent responses on/off within any conversation.

4. **Campaign Manager**

   - Create, edit, and manage bulk WhatsApp communication campaigns.

----------

## **Business Requirements**

### **Access & Authentication**

- Role-based access (admin, manager, operator, etc.).

- Login via password or Google Sign-In.

### **Business Rules**

- Data validation for campaign targets and chat records to avoid spam.

- No infinite loops or incessant follow-ups.

- Billing via **Stripe**: R$1 per unique customer served/month. First R$20 in credits are free; users must purchase additional credits after that.

### **Implementation Priorities**

- **High Priority**

  - **JavaScript Microservices** for Baileys and official WhatsApp API integrations.

  - WhatsApp-like Chat Interface (with AI toggling).

  - Pre-defined Virtual Assistants (Leads, Sales).

  - Basic metric monitoring & insights.

  - Campaign creation and management.

- **Medium Priority**

  - **Google Calendar integration**.

- **Low Priority**

  - **CRM integrations** (RD Station, HubSpot, Clinicorp, EasyDental, etc.).

----------

## **Conclusion**

This PRD outlines an **MVP-focused** platform to create and manage AI-powered WhatsApp assistants for any type of business. It prioritizes a **simple** yet **visually appealing** user experience and a modular, JavaScript-based approach to WhatsApp integrations. Over time, additional integrations (CRMs, advanced analytics) can be layered on, but for now, the goal is to deploy a fully functional, user-friendly solution that validates the core concept without overengineering for scale.