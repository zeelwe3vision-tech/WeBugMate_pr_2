import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Form, Button, Table, Spinner } from "react-bootstrap";
import { databaseService } from "../../services/supabase";
import { toast } from 'react-toastify';
import { motion } from "framer-motion";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Organization.css";

const Organization = () => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        description: ""
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        const { data, error } = await databaseService.getOrganizations();
        if (error) {
            toast.error("Failed to load organizations");
            console.error(error);
        } else {
            setOrganizations(data || []);
        }
        setLoading(false);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.warning("Organization Name is required");
            return;
        }

        setSubmitting(true);
        const { data, error } = await databaseService.createOrganization(formData);

        if (error) {
            toast.error("Error creating organization");
            console.error(error);
        } else {
            toast.success("Organization created successfully");
            setFormData({ name: "", description: "" });
            fetchOrganizations(); // Refresh list
        }
        setSubmitting(false);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this organization?")) {
            const { error } = await databaseService.deleteOrganization(id);
            if (error) {
                toast.error("Error deleting organization");
                console.error(error);
            } else {
                toast.success("Organization deleted successfully");
                fetchOrganizations();
            }
        }
    };

    return (
        <div className="organization-scroll-container">
            <Container className="py-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="page-title text-center">Organization Management</h2>
                </motion.div>

                <Row className="justify-content-center mb-5">
                    <Col md={8} lg={6}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <Card className="glass-card p-4">
                                <Card.Body>
                                    <h4 className="text-white mb-3">Add New Organization</h4>
                                    <Form onSubmit={handleSubmit}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="text-white">Organization Name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                className="glass-input"
                                                placeholder="Enter organization name"
                                                autoComplete="off"
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-4">
                                            <Form.Label className="text-white">Description</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                name="description"
                                                value={formData.description}
                                                onChange={handleChange}
                                                className="glass-input"
                                                placeholder="Enter description (optional)"
                                            />
                                        </Form.Group>

                                        <Button
                                            type="submit"
                                            className="btn-modern w-100"
                                            disabled={submitting}
                                        >
                                            {submitting ? <Spinner animation="border" size="sm" /> : "Create Organization"}
                                        </Button>
                                    </Form>
                                </Card.Body>
                            </Card>
                        </motion.div>
                    </Col>
                </Row>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <h4 className="text-white mb-3">Existing Organizations</h4>
                    <Card className="glass-card p-3">
                        <div className="table-responsive">
                            <Table className="custom-table mb-0" hover>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Description</th>
                                        <th style={{ width: '180px' }}>Created At</th>
                                        <th style={{ width: '100px' }} className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-4">
                                                <Spinner animation="border" variant="light" />
                                            </td>
                                        </tr>
                                    ) : organizations.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-4 text-muted">
                                                No organizations found.
                                            </td>
                                        </tr>
                                    ) : (
                                        organizations.map((org) => (
                                            <tr key={org.id}>
                                                <td className="fw-bold">{org.name}</td>
                                                <td>{org.description || "-"}</td>
                                                <td>{new Date(org.created_at).toLocaleDateString()}</td>
                                                <td className="text-center">
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleDelete(org.id)}
                                                        className="rounded-pill"
                                                    >
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card>
                </motion.div>
            </Container>
        </div>
    );
};

export default Organization;
