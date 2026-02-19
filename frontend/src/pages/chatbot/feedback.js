import React, { useState } from 'react';
import './feedback.css';
import { databaseService } from '../../services/supabase';
// import { FiArrowLeft } from 'react-icons/fi';

const problemTags = [
    'Application bugs', 'Customer service', 'Slow loading',
    'Bad navigation', 'Weak functionality', 'Other problems'
];


const Feedback = () => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [selectedTags, setSelectedTags] = useState([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleTagClick = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (rating === 0) {
            alert("Please select a star rating.");
            return;
        }
        setIsSubmitting(true);

        try {
            const response = await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/api/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer webugmate123"
                },
                credentials: "include",
                body: JSON.stringify({
                    rating,
                    comment: notes,
                    metadata: { tags: selectedTags }
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to submit feedback");
            }

            setIsSubmitting(false);
            setIsSubmitted(true);
            // Reset form
            setRating(0);
            setSelectedTags([]);
            setNotes('');

            setTimeout(() => setIsSubmitted(false), 3000);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="feedback-container">
            <div className="feedback-content">
                <h1 className="main-title">How was your overall experience?</h1>
                <p className="subtitle">It will help us to serve you better.</p>

                <div className="star-rating">
                    {[...Array(5)].map((star, index) => {
                        index += 1;
                        return (
                            <button
                                type="button"
                                key={index}
                                className={index <= (hover || rating) ? "on" : "off"}
                                onClick={() => setRating(index)}
                                onMouseEnter={() => setHover(index)}
                                onMouseLeave={() => setHover(rating)}
                            >
                                <span className="star">&#9733;</span>
                            </button>
                        );
                    })}
                </div>

                <h2 className="section-title">What is wrong?</h2>
                <div className="tags-container">
                    {problemTags.map(tag => (
                        <button
                            key={tag}
                            className={`tag-btn ${selectedTags.includes(tag) ? 'selected' : ''}`}
                            onClick={() => handleTagClick(tag)}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                <h2 className="section-title">Notes</h2>
                <textarea
                    className="notes-textarea"
                    placeholder="How we can do better?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />

                <button
                    className={`submit-btn${isSubmitting ? ' loading' : ''}${isSubmitted ? ' success' : ''}`}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    aria-live="polite"
                >
                    {isSubmitting ? 'Submitting…' : isSubmitted ? 'Submitted ✓' : 'Submit Feedback'}
                </button>
            </div>
        </div>
    );
};

export default Feedback;
