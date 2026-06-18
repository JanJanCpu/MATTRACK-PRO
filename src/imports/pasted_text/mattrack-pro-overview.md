MATTRACK PRO: A Neural network inventory and advisory system for multi-project procurement optimization and crowdsourcing stock locating

1.1 Background of the Study
The construction industry in the Philippines plays a vital role in the country’s economic development, infrastructure growth, and job creation. However, the increasing complexity of managing multiple projects simultaneously has made traditional management approaches insufficient. Efficient material tracking and workforce allocation are essential to maintaining productivity, but these tasks are often hampered by fragmented data and manual record-keeping.
In a multi-project environment, construction firms like PENTABUILD Construction Corporation face significant challenges in resource oversight. Currently, the company operates as a full-service provider, managing architectural, engineering, and general contracting services across Metro Manila. The simultaneous management of these sites often leads to unorganized manpower rostering, inaccurate material inventories, and a lack of visibility regarding surplus materials. When processes rely on isolated systems, the result is often unnecessary procurement, material waste, and project delays.
Traditional web-based systems offer centralized data storage, but they often remain passive, requiring project managers to manually analyze vast amounts of data to make procurement decisions. To address this, the study proposes the development of MatTrack Pro: A Neural Network Inventory and Advisory System for Multi-Project Procurement Optimization and Crowdsourcing Stock Locating. By integrating a Neural Network, the system moves beyond simple record-keeping to provide an intelligent advisory mechanism. This allows the system to analyze variables such as supplier pricing, geographical proximity, and logistics costs to recommend the most efficient procurement routes. Furthermore, the system implements an internal crowdsourcing model for stock locating, enabling site engineers to contribute real-time data on available surplus. This transformation into an intelligent, data-driven platform seeks to enhance operational efficiency, minimize resource waste, and support informed managerial decisions through predictive analytics.
1.2 Statement of the Problem
The management team of PENTABUILD Construction Corporation has identified that managing multiple project sites simultaneously leads to significant difficulties in resource oversight. Currently, the company relies on manual procurement decisions that fail to account for the complex trade-offs between price, distance, and material quality. Furthermore, the lack of real-time visibility into local store stock levels and internal site surpluses leads to unnecessary delays and resource waste.
Consequently, this study seeks to address the following problems:
Multi-Criteria Sourcing Optimization 
How can a Neural Network be designed to identify the best-value source by simultaneously ranking trusted suppliers and non-supplier local stores based on price, material quality, and proximity?
Predictive Stock Availability 
How can the system utilize crowdsourced data and lead-time analytics to provide real-time advisories on which sources are currently running low on stock?
Inefficient Logistics Routing 
How can the system integrate fastest path logic and internal surplus redistribution to ensure that site-specific material shortages are addressed with minimal travel time and zero waste?
1.3.1 General Objective
To develop MatTrack Pro, an intelligent inventory and advisory system that utilizes Neural Networks and crowdsourced data to optimize procurement, predict stock availability, and streamline logistics via internal surplus redistribution for PENTABUILD Construction Corporation.
1.3.2 Specific Objectives
Develop a Neural Network Procurement Model To evaluate and rank both established suppliers and non-supplier local stores by processing variables such as lowest price, proximity, and historical material quality.
Implement a Crowdsourced Stock Advisory Module To track material availability across the NCR using real-time user inputs and predictive analytics, flagging sources that are near out-of-stock scenarios.
Optimize Logistics via Fastest Path and Surplus Logic To automate the identification of the most efficient source through internal site-to-site transfers of non-moving materials (FSN Analysis) or external procurement via the fastest delivery route.
1.4 Significance of the Study
This study is significant to the following stakeholders:
PENTABUILD Construction Corporation The company will benefit from an intelligent decision-support tool that goes beyond simple record-keeping. By using a Neural Network for procurement, the corporation can achieve significant cost savings by identifying the most economical balance between material prices and logistics expenses. This leads to higher profitability and more competitive project bidding.
Project Managers and Site Engineers The system provides managers with an "Advisory" feature that simplifies complex decision-making. Instead of manually comparing dozens of suppliers and site inventories, they receive data-driven recommendations. The crowdsourcing aspect also fosters a collaborative environment where site engineers can assist one another by sharing surplus resources, reducing the pressure of sudden material shortages.
Suppliers and Logistics Providers The study promotes a more organized relationship between the company and its suppliers. By optimizing delivery routes and identifying nearby specialized providers, the system helps reduce transportation wear and tear and ensures that suppliers with the best performance and proximity are prioritized.
The Construction Industry in the Philippines This research serves as a proof-of-concept for integrating Artificial Intelligence (AI) into local construction practices. It demonstrates how traditional firms can transition into "Industry 4.0" by adopting predictive analytics and internal crowdsourcing to solve perennial problems like resource waste and uncoordinated procurement.
Future Researchers This study provides a foundational framework for researchers interested in applying Neural Networks to construction logistics. It offers insights into how internal crowdsourcing can be used as a data-collection method in environments where real-time APIs from external retailers are not readily available.

1.5 Scope and Limitations
Scope of the Study The primary focus of this study is the development of an intelligent project management system for PENTABUILD Construction Corporation. The system is designed to support the coordination of manpower, materials, and procurement across multiple sites in Metro Manila.
The study covers the following:
Target Users: Project managers, site engineers, and administrative staff.
System Features: The system includes Neural Network-based procurement advice, manpower rostering based on worker skills, and a crowdsourced stock-locating tool. It also organizes supplier listings and centralized project documentation.
Platform: The system is a computer-based web application accessible via standard desktop or laptop devices.
Limitations of the Study
Operational Scope: The system focuses on operational logistics. Financial functions such as payroll, budgeting, and detailed project costing are not included.
Data Dependency: The accuracy of the Neural Network's advice is dependent on the quality and volume of data provided, such as supplier price lists and historical logs.
Non-Automated Tracking: The system relies on manual data input and crowdsourced updates from site personnel rather than automated hardware sensors or IoT devices.
External Integration: The system utilizes a localized database of suppliers and web-scraped data rather than direct real-time API integration with external hardware retail chains.

(Ian’s addition)
Real-Time Traffic and Routing Constraints: While the system integrates "Fastest Path Logic" for logistics, routing calculations rely on distance and baseline API data (e.g., standard Google Maps or Leaflet APIs). The system does not account for sudden real-time traffic anomalies, localized road closures, or specific municipal truck bans in Metro Manila unless manually inputted by the user.
Neural Network Training Data: The efficiency of the Neural Network Procurement Model relies heavily on the initial dataset used for training. Due to the potential lack of digitized, clean historical data from PENTABUILD Construction Corporation, the initial AI model may be trained using a combination of available company records and simulated datasets. It is not designed to autonomously scrape the internet for real-time market fluctuations.
Crowdsourced Data Verification: The Crowdsourced Stock Advisory Module relies on the honesty and promptness of site engineers and users to update the availability and pricing of non-supplier local stores. The system does not feature an automated verification mechanism to cross-check these user-inputted prices against official store receipts or inventories.
Offline Functionality Limitations: As a web-based platform, MatTrack Pro requires a stable internet connection to perform real-time database syncing, map rendering, and Neural Network calculations. While basic UI elements may cache, the system does not support full offline operational capabilities or delayed data syncing for deep-excavation sites with zero cellular reception.
1.6 Definition of Terms
Multi-Criteria Sourcing Optimization – A decision-making process where multiple variables like price, location, and quality are weighed simultaneously to find the best purchase option.
FSN Analysis (Fast, Slow, and Non-moving) – An inventory categorization technique used to identify materials that are staying idle (non-moving) and should be prioritized for internal transfer.
Lead-time Analytics – The use of data to predict how long it will take for a material to be delivered from a specific source to the project site.
Non-Supplier Local Stores – Small-scale hardware stores or local vendors that are not part of the company’s official master list but offer proximity and immediate availability.
Fastest Path Logic – A computational algorithm used to determine the most time-efficient route between project sites and material sources, accounting for distance and geographical data.
(Ian’s addition)
Neural Network: In this study, it refers to the machine learning algorithm used to evaluate and score material sources based on price, quality, and distance.
Crowdsourcing: Refers to the system feature where site engineers and users manually input and update stock levels, prices, and locations of local non-supplier hardware stores.
MatTrack Pro: The proposed web-based inventory and advisory system specifically developed for PENTABUILD Construction Corporation.
Surplus Redistribution: The process of identifying excess materials at one project site and transferring them to another site experiencing a shortage.

