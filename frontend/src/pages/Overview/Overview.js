import "bootstrap/dist/css/bootstrap.min.css";
import { motion } from "framer-motion";
import { Button, Card, Col, Container, Row } from "react-bootstrap";
import "./Overview.css";

const Overview = () => {
  const modules = [
    {
      title: "Dashboard",
      text: "Real-time stats on ongoing, pending, and completed projects—allowing data-driven decisions instantly.",
      icon: "https://cdn-icons-png.flaticon.com/512/3208/3208726.png",
    },
    {
      title: "Project Management",
      text: "Create, update, and analyze projects in table or card view. Fully integrated with Supabase for real-time updates.",
      icon: "https://cdn-icons-png.flaticon.com/512/1019/1019607.png",
    },
    {
      title: "Role Administration",
      text: "Manage user permissions, roles, and task assignments with role-based access control.",
      icon: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
    },
    {
      title: "AI Chatbot Assistant",
      text: "Resolve queries instantly using our intelligent dual-mode chatbot powered by Gemini & LangChain.",
      icon: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
    },
    {
      title: "User Personalization",
      text: "Seamlessly switch between light & dark modes, manage profiles, and optimize workspace preferences.",
      icon: "https://cdn-icons-png.flaticon.com/512/5951/5951756.png",
    },
  ];

  const techStack = [
    "React.js",
    "Bootstrap 5",
    "Python FastAPI",  // udit start 
    "Supabase",
    "LangChain",
    "ChromaDB",
    "OpenRouter (Gemini)",
    "Hugging Face",
  ];

  const scrollToModules = () => {
    const el = document.getElementById('modules');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="overview-scroll-container">
      <div className="overview-modern">
        <Container className="py-5 text-white">
          {/* Hero Section */}
          <motion.div
            className="text-center mb-5"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="fw-bold display-5 mb-3 overview-title">
              WeBugMate Overview
            </h1>
            <p className="lead mx-auto" style={{ maxWidth: "850px" }}>
              An AI-powered workspace for modern teams — uniting project management, role-based access, and real-time troubleshooting with intelligent assistance.
            </p>
          </motion.div>

          {/* Purpose Section */}
          <Row className="align-items-center mb-5 ">
            <Col md={12}>
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="purpose-badge mb-2 d-inline-block">Why WeBugMate</span>
                <h3 className="fw-semibold mb-3 overview-title">Purpose of WeBugMate</h3>
                <p className="text-white">
                  webugmate enhances productivity by centralizing project information and providing instant AI-driven assistance. It integrates natural language understanding, role-based security, and data-driven insights to streamline enterprise collaboration.
                </p>
                <ul className="purpose-list mt-3 mb-0">
                  <li>Unified project visibility and faster decision-making</li>
                  <li>AI assistance embedded across workflows</li>
                  <li>Secure, role-based collaboration</li>
                </ul>
                <Button className="btn-modern mt-3" onClick={scrollToModules}>
                  Explore Features
                </Button>
              </motion.div>
            </Col>
          </Row>

          {/* Core Modules */}
          <section id="modules" className="mb-5">
            <h2 className="fw-bold text-center mb-4 overview-title">Core Modules</h2>
            <Row className="justify-content-center">
              {modules.map((mod, idx) => (
                <Col key={idx} md={4} sm={6} className="mb-4">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                  >
                    <Card className="glass-card text-center p-4 h-100">
                      <img
                        src={mod.icon}
                        alt={mod.title}
                        width="70"
                        className="mx-auto mb-3"
                      />
                      <Card.Title className="fw-bold text-white mb-2">
                        {mod.title}
                      </Card.Title>
                      <Card.Text className="text" >{mod.text}</Card.Text>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </section>

          {/* Tech Stack */}
          <section className="text-center mb-5">
            <h2 className="fw-bold mb-4 overview-title">Technology Stack</h2>
            <Row className="justify-content-center">
              {techStack.map((tech, idx) => (
                <Col key={idx} xs={6} sm={4} md={3} className="mb-3">
                  <motion.div
                    className="tech-tile p-3 rounded-3 fw-semibold"
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {tech}
                  </motion.div>
                </Col>
              ))}
            </Row>
          </section>

          {/* Footer */}
          {/* <div className="text-center mt-5 pt-4 border-top border-secondary">
            <p className="small text-light">
              © {new Date().getFullYear()} webugmate — Built with ❤️ by Team PP Savani
            </p>
          </div> */}
        </Container>
      </div>
    </div>
  );
};

export default Overview;
