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
        authors: '',
        file: null
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
            const response = await api.get('/submissions', {
                params: { sortBy: 'createdAt', order: 'desc' }
            });
            setSubmissions(response.data.submissions || []);
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

    const handleFileChange = (e) => {
        setFormData({ ...formData, file: e.target.files[0] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const submissionData = new FormData();
            submissionData.append('title', formData.title);
            submissionData.append('abstract', formData.abstract);
            
            // Process authors as JSON string
            const authorNames = formData.authors
                .split(',')
                .map(name => name.trim())
                .filter(Boolean);
            submissionData.append('authors', JSON.stringify(authorNames));
            
            // Process keywords as JSON string
            const keywords = formData.keywords
                .split(',')
                .map(kw => kw.trim())
                .filter(Boolean);
            submissionData.append('keywords', JSON.stringify(keywords));
            
            if (formData.file) {
                submissionData.append('file', formData.file);
            }

            if (editingId) {
                await api.put(`/submissions/${editingId}`, submissionData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Submission updated successfully');
            } else {
                await api.post('/submissions', submissionData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Journal submitted successfully');
            }
            setFormData({ 
                title: '', 
                abstract: '', 
                keywords: '', 
                authors: '', 
                file: null 
            });
            setEditingId(null);
            fetchSubmissions();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Submission failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="journal-submission-container max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-6">Journal Submissions</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title" required className="w-full p-2 border rounded-md mb-4" />
                <textarea name="abstract" value={formData.abstract} onChange={handleChange} placeholder="Abstract" required className="w-full p-2 border rounded-md h-32 mb-4" />
                <input type="text" name="keywords" value={formData.keywords} onChange={handleChange} placeholder="Keywords" required className="w-full p-2 border rounded-md mb-4" />
                <input type="text" name="authors" value={formData.authors} onChange={handleChange} placeholder="Authors" required className="w-full p-2 border rounded-md mb-4" />
                <input type="file" accept=".docx" onChange={handleFileChange} required={!editingId} className="w-full p-2 border rounded-md mb-4" />
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">{editingId ? 'Update' : 'Submit'}</button>
            </form>
        </div>
    );
};

export default JournalSubmission;
