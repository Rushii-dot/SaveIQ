const goals = [];

const API_URL = "http://127.0.0.1:5000";

const goalForm = document.getElementById("goalForm");
const goalsContainer = document.getElementById("goalsContainer");


// ==========================================
// CREATE GOAL
// ==========================================

goalForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const goalName =
        document.getElementById("goalName").value.trim();

    const targetAmount =
        Number(document.getElementById("targetAmount").value);

    const initialSavings =
        Number(document.getElementById("initialSavings").value);

    const deadline =
        document.getElementById("deadline").value;

    const email =
        document.getElementById("email").value.trim();

    const purpose =
        document.getElementById("purpose").value.trim();


    if (initialSavings > targetAmount) {

        alert(
            "Initial savings cannot be greater than target amount."
        );

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/goals`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    goalName,
                    targetAmount,
                    initialSavings,
                    deadline,
                    email,
                    purpose
                })
            }
        );


        const result = await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Failed to create goal."
            );
        }


        alert(
            "Goal created successfully!\n\nGoal ID: " +
            result.goalId
        );


        goalForm.reset();

        await loadGoals();


    } catch (error) {

        console.error(error);

        alert(
            "Could not create goal.\n\n" +
            error.message
        );
    }
});


// ==========================================
// LOAD ALL GOALS
// ==========================================

async function loadGoals() {

    try {

        const response =
            await fetch(`${API_URL}/api/goals`);


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Failed to load goals."
            );
        }


        goals.length = 0;


        result.goals.forEach(goal => {

            goals.push({

                id: goal.ID,

                goalName:
                    goal["Goal Name"],

                targetAmount:
                    Number(goal["Target Amount"]) || 0,

                savedAmount:
                    Number(goal["Saved Amount"]) || 0,

                deadline:
                    goal.Deadline,

                purpose:
                    goal.Purpose,

                email:
                    goal.Email

            });

        });


        renderGoals();

        updateDashboard();


    } catch (error) {

        console.error(
            "Load goals error:",
            error
        );

        goalsContainer.innerHTML = `
            <p class="empty-message">
                Unable to load goals from server.
            </p>
        `;
    }
}


// ==========================================
// DASHBOARD ANALYTICS
// ==========================================

function updateDashboard() {

    let totalTarget = 0;

    let totalSaved = 0;

    let activeGoals = 0;

    let completedGoals = 0;

    let overdueGoals = 0;


    const today = new Date();

    today.setHours(0, 0, 0, 0);


    goals.forEach(goal => {

        const target =
            Number(goal.targetAmount) || 0;

        const saved =
            Number(goal.savedAmount) || 0;


        totalTarget += target;

        totalSaved += saved;


        // COMPLETED

        if (saved >= target && target > 0) {

            completedGoals++;

            return;
        }


        // DEADLINE

        const deadline =
            new Date(goal.deadline);

        deadline.setHours(0, 0, 0, 0);


        if (deadline < today) {

            overdueGoals++;

        } else {

            activeGoals++;
        }

    });


    document.getElementById(
        "totalGoals"
    ).textContent = goals.length;


    document.getElementById(
        "totalSaved"
    ).textContent =
        formatCurrency(totalSaved);


    document.getElementById(
        "totalTarget"
    ).textContent =
        formatCurrency(totalTarget);


    document.getElementById(
        "activeGoals"
    ).textContent =
        activeGoals;


    document.getElementById(
        "completedGoals"
    ).textContent =
        completedGoals;


    document.getElementById(
        "overdueGoals"
    ).textContent =
        overdueGoals;
}


// ==========================================
// RENDER GOALS
// ==========================================

function renderGoals() {

    if (goals.length === 0) {

        goalsContainer.innerHTML = `
            <p class="empty-message">
                No savings goals yet.
            </p>
        `;

        return;
    }


    goalsContainer.innerHTML = "";


    goals.forEach(goal => {

        let percentage =
            goal.targetAmount > 0
                ? (goal.savedAmount /
                    goal.targetAmount) * 100
                : 0;


        percentage =
            Math.min(percentage, 100);


        const remaining =
            Math.max(
                goal.targetAmount -
                goal.savedAmount,
                0
            );


        const goalElement =
            document.createElement("div");


        goalElement.className =
            "goal-card";


        goalElement.innerHTML = `

            <h3>
                ${escapeHTML(goal.goalName)}
            </h3>

            <p>
                Saved:
                <strong>
                    ${formatCurrency(goal.savedAmount)}
                </strong>

                /

                ${formatCurrency(goal.targetAmount)}
            </p>


            <div class="progress-bar">

                <div
                    class="progress-fill"
                    style="width: ${percentage}%"
                ></div>

            </div>


            <p>
                ${percentage.toFixed(1)}% completed
            </p>


            <p>
                Remaining:
                <strong>
                    ${formatCurrency(remaining)}
                </strong>
            </p>


            <p>
                Deadline:
                ${escapeHTML(String(goal.deadline))}
            </p>


            <p>
                Purpose:
                ${escapeHTML(String(goal.purpose || ""))}
            </p>


            <div class="goal-actions">

                <button
                    onclick="addSavings('${goal.id}')"
                >
                    + Add Savings
                </button>


                <button
                    onclick="deleteGoal('${goal.id}')"
                >
                    Delete
                </button>


                <button
                    onclick="getAIInsights('${goal.id}')"
                >
                    🤖 AI Insights
                </button>

            </div>
        `;


        goalsContainer.appendChild(
            goalElement
        );

    });
}


// ==========================================
// UPDATE SAVINGS
// ==========================================

async function addSavings(goalId) {

    const amount =
        prompt("Enter savings amount:");


    if (amount === null) {

        return;
    }


    const savings =
        Number(amount);


    if (
        !Number.isFinite(savings) ||
        savings <= 0
    ) {

        alert(
            "Enter a valid savings amount."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/goals/${goalId}/savings`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        amount: savings
                    })
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Savings update failed."
            );
        }


        alert(
            "Savings updated successfully!"
        );


        await loadGoals();


    } catch (error) {

        console.error(error);

        alert(
            "Could not update savings.\n\n" +
            error.message
        );
    }
}


// ==========================================
// DELETE GOAL
// ==========================================

async function deleteGoal(goalId) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this goal?"
        );


    if (!confirmed) {

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/goals/${goalId}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Delete failed."
            );
        }


        alert(
            "Goal deleted successfully!"
        );


        await loadGoals();


    } catch (error) {

        console.error(error);

        alert(
            "Could not delete goal.\n\n" +
            error.message
        );
    }
}


// ==========================================
// AI INSIGHTS
// ==========================================

async function getAIInsights(goalId) {

    try {

        const response =
            await fetch(
               `http://127.0.0.1:5000/api/goals/${goalId}/ai-insights`
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Unable to generate AI insights."
            );
        }


        alert(
            "🤖 SaveIQ AI Insights\n\n" +
            result.insights
        );


    } catch (error) {

        console.error(error);

        alert(
            "AI insights are currently unavailable.\n\n" +
            error.message
        );
    }
}


// ==========================================
// CURRENCY FORMAT
// ==========================================

function formatCurrency(amount) {

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    ).format(amount);
}


// ==========================================
// BASIC HTML ESCAPE
// ==========================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// INITIAL LOAD
// ==========================================

loadGoals();