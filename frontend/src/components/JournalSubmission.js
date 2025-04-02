import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import './JournalSubmission.css';

const JournalSubmission = () => {
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        abstract: '',
        keywords: '',
        author: '',
        wordFileUrl: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/api/submissions');
            setSubmissions(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch submissions');
            toast.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingId) {
            await api.put(`/api/submissions/${editingId}`, formData);
        } else {
            await api.post('/api/submissions', formData);
        }
        setFormData({ title: '', abstract: '', keywords: '', author: '', wordFileUrl: '' });
        setEditingId(null);
        fetchSubmissions();
    };

    const handleEdit = (submission) => {
        setFormData({
            title: submission.title,
            abstract: submission.abstract,
            keywords: submission.keywords.join(', '),
            author: submission.author,
            wordFileUrl: submission.wordFileUrl
        });
        setEditingId(submission._id);
    };

    const handleDelete = async (id) => {
        await api.delete(`/api/submissions/${id}`);
        fetchSubmissions();
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="journal-submission-container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="header flex flex-col sm:flex-row justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Journal Submissions</h2>
                <Link 
                    to="/journals/new" 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    + New Submission
                </Link>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="mb-6">
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title" required />
                <textarea name="abstract" value={formData.abstract} onChange={handleChange} placeholder="Abstract" required />
                <input type="text" name="keywords" value={formData.keywords} onChange={handleChange} placeholder="Keywords (comma separated)" required />
                <input type="text" name="author" value={formData.author} onChange={handleChange} placeholder="Author" required />
                <input type="text" name="wordFileUrl" value={formData.wordFileUrl} onChange={handleChange} placeholder="Word File URL" required />
                <button type="submit" className="mt-4">{editingId ? 'Update Submission' : 'Submit Journal'}</button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {submissions.map(submission => (
                    <div key={submission._id} className="submission-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <h3 
                            className="text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                            onClick={() => handleEdit(submission)}
                        >
                            {submission.title}
                        </h3>
                        <p className="text-gray-600 mt-2 line-clamp-2">{submission.abstract}</p>
                        <div className="actions mt-4 flex flex-wrap gap-2">
                            <button 
                                onClick={() => handleEdit(submission)} 
                                className="text-blue-500 hover:text-blue-700"
                            >
                                Edit
                            </button>
                            <button 
                                onClick={() => handleDelete(submission._id)} 
                                className="text-red-500 hover:text-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JournalSubmission;
