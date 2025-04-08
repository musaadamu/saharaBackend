import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

export default function ManageJournal() {
    const { user } = useSelector((state) => state.auth);
    const [journals, setJournals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!user || user.role !== "admin") {
            navigate("/unauthorized");
            return;
        }

        async function fetchJournals() {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/journals`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                    },
                });
                if (!response.ok) throw new Error("Failed to fetch journals");

                const data = await response.json();
                setJournals(Array.isArray(data.journals) ? data.journals : []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchJournals();
    }, [user, navigate]);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this journal?")) return;
        
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/journals/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                },
            });

            if (!response.ok) throw new Error("Failed to delete journal");
            
            setJournals((prev) => prev.filter((journal) => journal._id !== id));
        } catch (error) {
            console.error("Error deleting journal:", error);
        }
    };

    const handleView = (id) => {
        navigate(`/journals/${id}`);
    };

    const handleAdd = () => {
        navigate("/journals/uploads");
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="bg-red-100 text-red-700 p-2">{error}</div>;

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 shadow-md rounded-lg">
            <h1 className="text-2xl font-bold mb-4">Manage Journals</h1>

            <button
                onClick={handleAdd}
                className="mb-4 p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Upload New Journal
            </button>

            {journals.length === 0 ? (
                <p>No journals available.</p>
            ) : (
                <ul className="space-y-3">
                    {journals.map((journal) => (
                        <li key={journal._id} className="p-3 border rounded flex justify-between items-center">
                            <span className="font-semibold">{journal.title}</span>
                            <div className="space-x-2">
                                <button
                                    onClick={() => handleView(journal._id)}
                                    className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    View
                                </button>
                                <button
                                    onClick={() => handleDelete(journal._id)}
                                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
