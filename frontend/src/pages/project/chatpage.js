import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
} from "react-bootstrap";
import { useParams } from "react-router-dom";
import { useMessages } from "../../contexts/messagecontext"; // import context

const ChatPage = () => {
  const { email } = useParams(); // target employee email
  const { messages, sendMessage } = useMessages();
  const [newMessage, setNewMessage] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPriority, setTaskPriority] = useState("Normal");

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessage(email, newMessage); // send chat
    setNewMessage("");
  };

  const handleAssignTask = () => {
    if (!taskTitle.trim()) return;
    const taskMessage = `📌 Task Assigned: ${taskTitle} | Deadline: ${taskDeadline || "N/A"} | Priority: ${taskPriority}`;
    sendMessage(email, taskMessage);
    setTaskTitle("");
    setTaskDeadline("");
    setTaskPriority("Normal");
  };

  const chatMessages = messages[email] || [];

  return (
    <Container fluid className="p-4">
      <Row style={{ marginTop: "100px" }}>
        {/* Left Side - Task Sheet & Chat History */}
        <Col lg={8} md={7} sm={12} className="mb-3">
          <Card className="shadow-sm h-100">
            <Card.Header className="fw-bold bg-primary text-white">
              Task Sheet & Chat with {email}
            </Card.Header>
            <Card.Body className="p-0">
              <Table striped bordered hover responsive className="mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Message / Task</th>
                    <th>Sender</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {chatMessages.length > 0 ? (
                    chatMessages.map((msg, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{msg.text}</td>
                        <td>
                          <Badge
                            bg={msg.sender === "Leader" ? "success" : "secondary"}
                          >
                            {msg.sender}
                          </Badge>
                        </td>
                        <td className="small text-muted">{msg.time}</td>
                        <td>
                          {msg.text.startsWith("📌 Task") ? (
                            <Badge bg="warning">Assigned</Badge>
                          ) : (
                            <Badge bg="info">Message</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No messages or tasks yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Side - Assign Task / Send Message */}
        <Col lg={4} md={5} sm={12}>
          <Card className="shadow-sm h-100">
            <Card.Header className="fw-bold bg-dark text-white">
              Assign Task / Send Message
            </Card.Header>
            <Card.Body>
              {/* Task Form */}
              <Form className="mb-4">
                <h6 className="mb-3">📌 Assign Task</h6>
                <Form.Group className="mb-2">
                  <Form.Control
                    type="text"
                    placeholder="Task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                </Form.Group>
                <Row>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">Deadline</Form.Label>
                      <Form.Control
                        type="date"
                        value={taskDeadline}
                        onChange={(e) => setTaskDeadline(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">Priority</Form.Label>
                      <Form.Select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                      >
                        <option>Low</option>
                        <option>Normal</option>
                        <option>High</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-grid mb-3">
                  <Button
                    variant="success"
                    onClick={handleAssignTask}
                    disabled={!taskTitle.trim()}
                  >
                    Assign Task
                  </Button>
                </div>
              </Form>

              {/* Chat Form */}
              <Form>
                <h6 className="mb-3">💬 Send Message</h6>
                <Form.Group className="mb-3">
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Write your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                </Form.Group>
                <div className="d-grid">
                  <Button variant="primary" onClick={handleSendMessage}>
                    Send Message
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ChatPage;
