import { Card, Badge, Table, Container, Button, Modal, Form, Alert, Row, Col } from "react-bootstrap";
import { useContext, useState, useEffect } from "react";
import { MyContext } from "../../App";
import { usePermissions, PermissionButton } from "../../utils/permissionUtils";
import { databaseService } from "../../services/supabase";
import { useMessages } from "../../contexts/messagecontext";
import "./Announcements.css";

const Announcements = () => {
    const { userEmail, userRole } = useContext(MyContext);
    const { canView, canUpdate } = usePermissions();
    const { sendMessage, getConversationMessages } = useMessages();

    // State for announcements from backend
    const [announcements, setAnnouncements] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for send announcement modal
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendForm, setSendForm] = useState({
        recipient_email: '',
        message: ''
    });
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState(null);
    const [sendSuccess, setSendSuccess] = useState(false);

    // State for user emails dropdown
    const [userEmails, setUserEmails] = useState([]);
    const [loadingEmails, setLoadingEmails] = useState(false);


    // State for chat modal
    const [showChatModal, setShowChatModal] = useState(false);
    const [chatRecipient, setChatRecipient] = useState(null);
    const [chatMessage, setChatMessage] = useState('');
    const [chatSuccess, setChatSuccess] = useState(false);

    // State for reply functionality
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [replySuccess, setReplySuccess] = useState(false);

    // Fetch user emails for dropdown
    const fetchUserEmails = async () => {
        try {
            setLoadingEmails(true);
            const { data, error } = await databaseService.getAllUserLogins();

            if (error) {
                console.error('Error fetching user emails:', error);
                return;
            }

            if (data) {
                // Extract emails and names, exclude current user
                const emails = data
                    .filter(user => user.email !== userEmail) // Exclude current user
                    .map(user => ({
                        email: user.email,
                        name: user.name || 'Unknown User',
                        role: user.role || 'Employee'
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name

                setUserEmails(emails);
            }
        } catch (error) {
            console.error('Error fetching user emails:', error);
        } finally {
            setLoadingEmails(false);
        }
    };

    const fetchAnnouncements = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setError(null);

            console.log('🔍 Fetching announcements via Backend for:', userEmail);

            const response = await fetch(`https://zeelsheta-webugmate-backend-pr-2-1.hf.space/announcements/get?user_email=${encodeURIComponent(userEmail)}`, {
                headers: {
                    'Authorization': 'Bearer webugmate123',
                    'user_email': userEmail
                }
            });
            const data = await response.json();

            if (!data || (data.error)) {
                console.error('❌ Backend error:', data.error);
                setError(`Fetch error: ${data.error || 'Failed to load'}`);
                return;
            }

            if (data && data.length > 0) {
                console.log('📝 Found announcements for user:', data.length);

                // Group by conversation (sender-recipient pair) for display
                const groupedAnnouncements = {};
                data.forEach(announcement => {
                    // Create a conversation key that includes both sender and recipient
                    const conversationKey = announcement.sender_email === userEmail
                        ? announcement.recipient_email
                        : announcement.sender_email;

                    if (!groupedAnnouncements[conversationKey]) {
                        groupedAnnouncements[conversationKey] = [];
                    }

                    // Format timestamp
                    const timestamp = announcement.timestamp;
                    const formattedTime = timestamp ?
                        new Date(timestamp).toLocaleString() :
                        'Unknown time';

                    groupedAnnouncements[conversationKey].push({
                        id: announcement.id,
                        sender: announcement.sender_email,
                        text: announcement.message,
                        time: formattedTime,
                        status: announcement.status || 'Message',
                        type: announcement.status || 'General'
                    });
                });

                setAnnouncements(groupedAnnouncements);
                console.log('📦 Grouped announcements:', groupedAnnouncements);
            } else {
                console.log('📭 No announcements found');
                setAnnouncements({});
            }

        } catch (err) {
            console.error('❌ Error:', err);
            setError(`Error loading announcements: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, [userEmail]);

    // Fetch user emails when component mounts
    useEffect(() => {
        fetchUserEmails();
    }, [userEmail]);

    // Fetch emails when modal opens
    useEffect(() => {
        if (showSendModal) {
            fetchUserEmails();
        }
    }, [showSendModal]);

    // Periodic refresh to show real-time changes
    useEffect(() => {
        if (!userEmail) return;
        const interval = setInterval(() => {
            fetchAnnouncements(true);
        }, 5000); // Update every 5 seconds
        return () => clearInterval(interval);
    }, [userEmail]);

    // Handle sending announcement
    const handleSendAnnouncement = async (e) => {
        e.preventDefault();
        setSending(true);
        setSendError(null);
        setSendSuccess(false);

        try {
            console.log('📤 Sending announcement via Backend...');

            const response = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/announcements/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer webugmate123',
                    'user_email': userEmail
                },
                body: JSON.stringify({
                    sender_email: userEmail,
                    recipient_email: sendForm.recipient_email,
                    message: sendForm.message,
                    type: sendForm.message.startsWith("📌 Task") ? "Task" : "Message",
                    created_by: userEmail
                })
            });

            const data = await response.json();

            if (!data.success) {
                console.error('❌ Backend error:', data.error);
                setSendError(`Failed to send announcement: ${data.error}`);
                return;
            }

            console.log('✅ Announcement sent successfully:', data);
            setSendSuccess(true);
            setSendForm({ recipient_email: '', message: '' });

            // Also send to message context for real-time chat
            sendMessage(sendForm.recipient_email, sendForm.message);

            // Refresh announcements
            await fetchAnnouncements();

            setTimeout(() => {
                setShowSendModal(false);
                setSendSuccess(false);
            }, 2000);

        } catch (err) {
            console.error('❌ Error sending announcement:', err);
            setSendError(`Error sending announcement: ${err.message}`);
        } finally {
            setSending(false);
        }
    };
    const handleDeleteAnnouncement = async (announcementId) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;

        try {
            const response = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/announcements/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer webugmate123',
                    'user_email': userEmail
                },
                body: JSON.stringify({ id: announcementId })
            });

            const data = await response.json();

            if (!data.success) {
                console.error("Error deleting announcement:", data.error);
                alert("Failed to delete announcement!");
                return;
            }

            alert("Announcement deleted successfully!");
            fetchAnnouncements(); // Refresh list
        } catch (err) {
            console.error("Error deleting announcement:", err);
            alert("Error deleting announcement. See console.");
        }
    };

    // Handle opening chat modal
    const handleOpenChat = (recipientEmail) => {
        const recipient = userEmails.find(user => user.email === recipientEmail);
        setChatRecipient(recipient || { email: recipientEmail, name: recipientEmail });
        setShowChatModal(true);
    };

    // Handle sending chat message
    const handleSendChatMessage = async (e) => {
        e.preventDefault();
        if (chatMessage.trim() && chatRecipient) {
            try {
                // Send to message context for real-time display
                sendMessage(chatRecipient.email, chatMessage);

                // Also save to database for persistence via Backend
                const response = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/announcements/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer webugmate123',
                        'user_email': userEmail
                    },
                    body: JSON.stringify({
                        sender_email: userEmail,
                        recipient_email: chatRecipient.email,
                        message: chatMessage,
                        type: chatMessage.startsWith("📌 Task") ? "Task" : "Message"
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    console.error('Error saving chat message to database:', data.error);
                } else {
                    console.log('Chat message saved via backend successfully');
                    // Refresh announcements to show the new message
                    await fetchAnnouncements();
                    setChatSuccess(true);
                    setTimeout(() => setChatSuccess(false), 3000);
                }

                setChatMessage('');
            } catch (err) {
                console.error('Error sending chat message:', err);
                // Still send to message context even if database save fails
                sendMessage(chatRecipient.email, chatMessage);
                setChatMessage('');
            }
        }
    };

    // Handle opening reply modal
    const handleOpenReply = (message) => {
        setReplyToMessage(message);
        setShowReplyModal(true);
    };

    // Handle sending reply
    const handleSendReply = async (e) => {
        e.preventDefault();
        if (replyMessage.trim() && replyToMessage && chatRecipient) {
            try {
                // Send to message context for real-time display
                sendMessage(chatRecipient.email, replyMessage);

                // Also save to database for persistence via Backend
                const response = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/announcements/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer webugmate123',
                        'user_email': userEmail
                    },
                    body: JSON.stringify({
                        sender_email: userEmail,
                        recipient_email: chatRecipient.email,
                        message: replyMessage,
                        type: replyMessage.startsWith("📌 Task") ? "Task" : "Message"
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    console.error('Error saving reply to database:', data.error);
                } else {
                    console.log('Reply saved via backend successfully');
                    // Refresh announcements to show the new message
                    await fetchAnnouncements();
                    setReplySuccess(true);
                    setTimeout(() => setReplySuccess(false), 3000);
                }

                setReplyMessage('');
                setShowReplyModal(false);
            } catch (err) {
                console.error('Error sending reply:', err);
                // Still send to message context even if database save fails
                sendMessage(chatRecipient.email, replyMessage);
                setReplyMessage('');
                setShowReplyModal(false);
            }
        }
    };


    // Local state to track task statuses
    const [taskStatus, setTaskStatus] = useState({});

    const handleStatusChange = (email, idx, status) => {
        setTaskStatus((prev) => ({
            ...prev,
            [`${email}-${idx}`]: status,
        }));
        // TODO: Optionally, send this update to your backend to persist
    };

    // Use the grouped announcements directly (they are already correctly filtered)
    const visibleMessages = announcements;

    if (loading) {
        return (
            <Container fluid className="p-4 announcements-container" style={{ marginTop: "90px" }}>
                <h2 className="fw-bold mb-4 page-title">Announcements</h2>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading announcements...</p>
                </div>
            </Container>
        );
    }

    if (error) {
        return (
            <Container fluid className="p-4 announcements-container" style={{ marginTop: "90px" }}>
                <h2 className="fw-bold mb-4 page-title">Announcements</h2>
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            </Container>
        );
    }

    const totalConversations = Object.keys(visibleMessages).length;
    const totalMessages = Object.values(visibleMessages).reduce((acc, arr) => acc + arr.length, 0);

    return (
        <Container fluid className=" announcements-container" style={{ paddingTop: "120px" }}>
            {/* Hero Header */}
            <div className="ann-hero glass-surface">
                <div className="ann-hero-left">
                    <h1 className="page-title mb-1">Messages</h1>
                    <p className="ann-hero-sub">Communicate and track announcements across your team.</p>
                    <div className="ann-chips">
                        <span className="chip"><span className="dot" />Conversations <b>{totalConversations}</b></span>
                        <span className="chip"><span className="dot" />Messages <b>{totalMessages}</b></span>
                    </div>
                </div>
                <div className="ann-hero-right">
                    <Button onClick={() => setShowSendModal(true)} className="ghost-btn">
                        <span className="me-2">📤</span> Send Messages
                    </Button>
                </div>
            </div>

            {/* Toolbar (placeholder for future filters/search) */}
            <div className="ann-toolbar">
                <span className="muted">Recent conversations</span>
            </div>

            {Object.keys(visibleMessages).length === 0 ? (
                <p className="text-muted">No announcements yet.</p>
            ) : (
                Object.entries(visibleMessages).map(([conversationPartner, msgs]) => {
                    // Get the partner's name from userEmails or use email
                    const partnerInfo = userEmails.find(user => user.email === conversationPartner) ||
                        { name: conversationPartner, email: conversationPartner };

                    return (
                        <Card key={conversationPartner} className="mb-4 shadow-sm border-0 ann-card glass-surface">
                            <Card.Header className="glass-header text-white d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="bullet" /> Conversation with <span className="fw-bold">{partnerInfo.email}</span>
                                </div>
                                <div>
                                    <Button size="sm" className="ghost-btn" onClick={() => handleOpenChat(conversationPartner)}>💬 Chat</Button>
                                </div>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <Table hover responsive className="mb-0 ann-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Message / Task</th>
                                            <th>From</th>
                                            <th>Time</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {msgs.map((msg, idx) => {
                                            const key = `${conversationPartner}-${idx}`;
                                            const status = taskStatus[key] || (msg.text.startsWith("📌 Task") ? "Pending" : "Message");

                                            // Debug logging
                                            console.log('Debug delete button:', {
                                                msgSender: msg.sender,
                                                userEmail: userEmail,
                                                areEqual: msg.sender === userEmail,
                                                msgId: msg.id
                                            });

                                            return (
                                                <tr key={idx}>
                                                    <td>{idx + 1}</td>
                                                    <td>{msg.text}</td>
                                                    <td className="small text-muted">
                                                        {msg.sender}

                                                    </td>
                                                    <td className="small text-muted">{msg.time}</td>

                                                    <td>
                                                        <div className="d-flex gap-1">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                onClick={() => handleOpenChat(conversationPartner)}
                                                                title="Start chat"
                                                            >
                                                                💬
                                                            </Button>
                                                            {msg.sender && userEmail && msg.sender.trim().toLowerCase() === userEmail.trim().toLowerCase() && (
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteAnnouncement(msg.id)}
                                                                    title="Delete announcement"
                                                                >
                                                                    🗑️
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>


                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </Card.Body>
                        </Card>
                    );
                })
            )}

            {/* Real-time Chat Messages Section */}
            {userEmails.length > 0 && (
                <Card className="mb-4 shadow-sm border-0 ann-card glass-surface">
                    <Card.Header className="glass-header text-white d-flex align-items-center gap-2">
                        <span className="bullet" /> Real-time Chat Messages
                    </Card.Header>
                    <Card.Body className="p-0">
                        <Table hover responsive className="mb-0 ann-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Chat Partner</th>
                                    <th>Latest Message</th>
                                    <th>Time</th>
                                    <th>Type</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userEmails.map((user, idx) => {
                                    // Get messages from database for this user
                                    const conversationMessages = Object.entries(announcements)
                                        .filter(([conversationPartner]) => conversationPartner === user.email)
                                        .flatMap(([, msgs]) => msgs)
                                        .sort((a, b) => new Date(a.time) - new Date(b.time));

                                    const latestMessage = conversationMessages[conversationMessages.length - 1];

                                    if (!latestMessage) return null;

                                    return (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>

                                                <small className="text-muted">{user.email}</small>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-start gap-2">

                                                    <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {latestMessage.text}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="small text-muted">{latestMessage.time}</td>
                                            <td>
                                                <Badge bg={latestMessage.text.startsWith("📌 Task") ? "warning" : "secondary"}>
                                                    {latestMessage.text.startsWith("📌 Task") ? "📌 Task" : "💬 Message"}
                                                </Badge>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => handleOpenChat(user.email)}
                                                        title="Open chat"
                                                    >
                                                        💬 Chat
                                                    </Button>

                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }).filter(Boolean)}
                            </tbody>
                        </Table>
                        {userEmails.every(user => {
                            const conversationMessages = Object.entries(announcements)
                                .filter(([conversationPartner]) => conversationPartner === user.email)
                                .flatMap(([, msgs]) => msgs);
                            return conversationMessages.length === 0;
                        }) && (
                                <div className="text-center text-muted py-3">
                                    No chat messages yet. Start a conversation!
                                </div>
                            )}
                    </Card.Body>
                </Card>
            )}



            {/* Send Announcement Modal */}
            <Modal
                show={showSendModal}
                onHide={() => setShowSendModal(false)}
                size="lg"
                dialogClassName="ann-modal-dialog"
                contentClassName="ann-modal-content"
                backdropClassName="ann-modal-backdrop"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>📤 Send Announcement & Chat Message</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {sendSuccess && (
                        <Alert variant="success" className="mb-3">
                            ✅ Announcement sent successfully! (Saved to database and sent to chat)
                        </Alert>
                    )}
                    {sendError && (
                        <Alert variant="danger" className="mb-3">
                            ❌ {sendError}
                        </Alert>
                    )}
                    <Form onSubmit={handleSendAnnouncement}>
                        <Form.Group className="mb-3">
                            <Form.Label>Recipient Email</Form.Label>
                            <Form.Select
                                value={sendForm.recipient_email}
                                onChange={(e) => setSendForm({ ...sendForm, recipient_email: e.target.value })}
                                required
                                disabled={loadingEmails}
                            >
                                <option value="">
                                    {loadingEmails ? 'Loading users...' : 'Select a recipient'}
                                </option>
                                {userEmails.map((user, index) => (
                                    <option key={index} value={user.email}>
                                        {user.name} ({user.email}) - {user.role}
                                    </option>
                                ))}
                            </Form.Select>
                            {userEmails.length === 0 && !loadingEmails && (
                                <Form.Text className="text-muted">
                                    No other users found. You can still type an email manually below.
                                </Form.Text>
                            )}
                        </Form.Group>

                        {/* Manual email input as fallback */}


                        <Form.Group className="mb-3">
                            <Form.Label>Message</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={4}
                                placeholder="Enter your announcement message..."
                                value={sendForm.message}
                                onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                                required
                            />

                        </Form.Group>
                        <div className="d-flex justify-content-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowSendModal(false)}
                                disabled={sending}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={sending}
                            >
                                {sending ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Sending...
                                    </>
                                ) : (
                                    'Send Announcement'
                                )}
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Chat Modal */}
            <Modal
                show={showChatModal}
                onHide={() => setShowChatModal(false)}
                size="lg"
                dialogClassName="ann-modal-dialog"
                contentClassName="ann-modal-content"
                backdropClassName="ann-modal-backdrop"
                fullscreen
                centered

            >
                <Modal.Header closeButton>
                    <Modal.Title className="d-flex align-items-center gap-2">
                        💬 Chat with {chatRecipient?.name || chatRecipient?.email}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Chat Messages */}
                    <div className="ann-chat-scroll">
                        {chatRecipient && (() => {
                            // Get messages for this specific conversation from the database
                            const conversationMessages = Object.entries(announcements)
                                .filter(([conversationPartner]) => conversationPartner === chatRecipient.email)
                                .flatMap(([, msgs]) => msgs)
                                .sort((a, b) => new Date(a.time) - new Date(b.time)); // Sort by time

                            return conversationMessages.length > 0 ? (
                                conversationMessages.map((msg, idx) => {
                                    const isMine = msg.sender === userEmail;
                                    return (
                                        <div key={idx} className={`chat-row ${isMine ? 'end' : 'start'}`}>
                                            <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`}>
                                                <div className="chat-text">{msg.text}</div>
                                                <div className="chat-meta">{msg.time}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-muted py-4">
                                    No messages yet. Start the conversation!
                                </div>
                            );
                        })()}
                    </div>

                    {/* Send Message Form */}
                    <Form onSubmit={handleSendChatMessage}>
                        {chatSuccess && (
                            <Alert variant="success" className="mb-3">
                                ✅ Message sent successfully!
                            </Alert>
                        )}
                        <Form.Group className="mb-3">
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Type your message here..."
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <div className="d-flex justify-content-between align-items-center">
                            <Form.Text className="text-muted">
                                💡 This message will be sent to the recipient's chat
                            </Form.Text>
                            <div className="d-flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowChatModal(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={!chatMessage.trim()}
                                >
                                    Send Message
                                </Button>
                            </div>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>


        </Container>
    );
};

export default Announcements;
