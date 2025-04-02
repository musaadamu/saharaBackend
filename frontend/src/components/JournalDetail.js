import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

import { toast } from 'react-toastify';
import api from '../services/api';

import { toast } from 'react-toastify';
import api from '../services/api';

import { useParams } from 'react-router-dom';
import './JournalDetails.css';

const JournalDetail = () => {
    const { id } = useParams(); // Get the journal ID from the URL
    const [journal, setJournal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [error, setError] = useState('');

    const [error, setError] = useState('');

    const [error, setError] = useState('');

    useEffect(() => {
    const fetchJournal = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/journals/${id}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch journal details');

            const data = await response.json();
            setJournal(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/journals/${id}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch journal details');

            const data = await response.json();
            setJournal(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/journals/${id}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch journal details');

            const data = await response.json();
            setJournal(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/journals/${id}`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                    },
                });

                if (!response.ok) throw new Error('Failed to fetch journal details');

                const data = await response.json();
                setJournal(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchJournal();
    }, [id]);

    const handleDownload = async (fileType) => {
        try {
            const { data } = await api.get(`/journals/${id}/download/${fileType}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${journal?.title || 'journal'}.${fileType}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Journal downloaded as ${fileType.toUpperCase()}`);
        } catch (err) {
            toast.error(`Failed to download ${fileType.toUpperCase()} file`);
        }
    };

    const handleDownload = async (fileType) => {
        try {
            const { data } = await api.get(`/journals/${id}/download/${fileType}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${journal?.title || 'journal'}.${fileType}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Journal downloaded as ${fileType.toUpperCase()}`);
        } catch (err) {
            toast.error(`Failed to download ${fileType.toUpperCase()} file`);
        }
    };

    const handleDownload = async (fileType) => {
        try {
            const { data } = await api.get(`/journals/${id}/download/${fileType}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${journal?.title || 'journal'}.${fileType}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Journal downloaded as ${fileType.toUpperCase()}`);
        } catch (err) {
            toast.error(`Failed to download ${fileType.toUpperCase()} file`);
        }
    };

    if (loading) return <p className="text-gray-600">Loading...</p>;



    if (error) return <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>;

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 shadow-md rounded-lg">
            <h2 className="text-2xl font-bold mb-4">{journal?.title || 'Untitled Journal'}</h2>
            
            <div className="space-y-3">
                <p><strong>Abstract:</strong> {journal?.abstract || 'No abstract available'}</p>
                <p><strong>Content:</strong> {journal?.content || 'Download PDF or WORD file'}</p>

                {journal?.pdfUrl && (
                    <p>
                        <strong>PDF:</strong> 
                        <button 
                            onClick={() => handleDownload('pdf')} 
                            className="text-blue-600 hover:underline"
                        >
                            Download PDF
                        </button>
                    </p>
                )}

                {journal?.docxFilePath && (
                    <p>
                        <strong>Word Document:</strong> 
                        <button 
                            onClick={() => handleDownload('docx')} 
                            className="text-blue-600 hover:underline"
                        >
                            Download Word Document
                        </button>
                    </p>
                )}


                {journal?.pdfUrl && (
                    <p>
                        <strong>PDF:</strong> 
                        <button 
                            onClick={() => handleDownload('pdf')} 
                            className="text-blue-600 hover:underline"
                        >
                            Download PDF
                        </button>
                    </p>
                )}

                {journal?.docxFilePath && (
                    <p>
                        <strong>Word Document:</strong> 
                        <button 
                            onClick={() => handleDownload('docx')} 
                            className="text-blue-600 hover:underline"
                        >
                            Download Word Document
                        </button>
                    </p>
                )}


                {journal?.pdfUrl && (
                    <p>
                        <strong>PDF:</strong> 
                        <button 
                            onClick={() => handleDownload('pdf')} 
                            className="text-blue-600 hover:underline"
                        >
                            Download PDF
                        </button>
                    </p>
                )}

                {journal?.docxFilePath && (
                    <p>
                        <strong>Word Document:</strong> 
                        <button 
                            onClick={() => handleDownload('docx')} 
                            className="text-blue-600 hover:underline"
                        >
                            Download Word Document
                        </button>
                    </p>
                )}


                {journal?.pdfUrl && (
                    <p>
                        <strong>PDF:</strong> 
                        <a 
                            href={journal.pdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline"
                        >
                            Download PDF
                        </a>
                    </p>
                )}

                {journal?.docxFilePath && (
                    <p>
                        <strong>Word Document:</strong> 
                        <a 
                            href={journal.docxFilePath} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline"
                        >
                            Download Word Document
                        </a>
                    </p>
                )}

                <p><strong>Keywords:</strong> {journal?.keywords?.join(', ') || 'No keywords'}</p>
                <p><strong>Status:</strong> {journal?.status || 'Unknown'}</p>
                <p><strong>Published Date:</strong> {journal?.publishedDate ? new Date(journal.publishedDate).toLocaleDateString() : 'Not published yet'}</p>
            </div>
        </div>
    );
};

export default JournalDetail;
