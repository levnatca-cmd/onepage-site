# Historical LEVNAT page inventory

This inventory describes an earlier version of the site. See the [current repository map](../../README.md#repository-map) for page ownership and entry points.

LEVNAT has nine main pages, one interactive service map, and a start page that opens either experience.

| Page                           | URL path                   | Functionality                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start                          | `/`                        | Opens Starworld for a dark browser theme or the light Home page for a light theme. Visitors can choose either page manually if JavaScript is disabled.                                                                               |
| 1. Home                        | `/home/`                   | Introduces LEVNAT's development, integration and support services. Visitors can choose **Describe your project** or **Explore services**, and try the Daybook booking demo with sample requests and simulated faults.                |
| 2. Services                    | `/services/`               | Lists service categories, specialist options and starting prices in CAD. Visitors can open a detailed service page, explore the Starworld map or start an inquiry.                                                                   |
| 3. Websites and Apps           | `/services/websites-apps/` | Explains what LEVNAT can build, including websites, portals, web apps and native iOS apps. Shows the delivery process and starting prices. Its inquiry link preselects this service.                                                 |
| 4. Integrations and Automation | `/services/integrations/`  | Explains how LEVNAT connects tools and data, builds backends and APIs, and automates workflows. Shows starting prices. Its inquiry link preselects this service.                                                                     |
| 5. Debugging and Support       | `/services/support/`       | Describes investigation of software and device issues, maintenance options and support pricing. Visitors can open an inquiry for a technical issue.                                                                                  |
| 6. Work and Demos              | `/work/`                   | Presents independent prototypes and experiments. Visitors can open the Daybook case study, filter experiments, add a sample request, run a simulated workflow or open a 3D explorer.                                                 |
| 7. Daybook Case Study          | `/work/daybook/`           | Explains how the booking prototype validates requests, queues them when disconnected and retries them after simulated API or device faults. Links to the interactive demo on Home.                                                   |
| 8. Approach                    | `/approach/`               | Explains how a project moves from the first inquiry through scope, delivery and handover. Describes the optional paid planning session and links to Contact with that option selected.                                               |
| 9. Contact and Project Inquiry | `/contact/`                | Collects project details and a reply address. The protected HTTPS deployment accepts the inquiry and returns a reference after storing it securely.                                                                                  |
| 10. Starworld Service Map      | `/starworld.html`          | Lets visitors explore service areas through a 3D scene or a list. They can review example deliverables, select multiple services, add notes and download a brief or open an email draft. The brief stays in the current browser tab. |

The main navigation links to Services, Work and Approach. The LEVNAT logo leads directly to Home, and **Let's talk** opens Contact. Service details and Starworld are linked from Services. The Daybook case study is linked from Home and Work. Direct page links open the linked page regardless of the visitor's theme.

Contact and Starworld prepare drafts. Visitors review and send the message in their own email app.
